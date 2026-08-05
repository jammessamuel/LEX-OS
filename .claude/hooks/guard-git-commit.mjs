#!/usr/bin/env node
// Claude Code PreToolUse guard for Bash calls.
//
// Blocks, before git runs:
//   1. commit/tag/merge/revert messages carrying AI attribution;
//   2. --no-verify, which would bypass the .githooks/commit-msg backstop;
//   3. force pushes, which are destructive and outward-facing.
//
// Contract: read the hook payload on stdin, exit 0 to allow, exit 2 to block with the
// reason on stderr. Any other failure mode must stay non-blocking.

const attributionPatterns = [
  {
    // Co-Authored-By / Signed-off-by naming a model or AI tool.
    pattern:
      /(?:co-?authored-by|signed-off-by|author)\s*:[^\n]*\b(?:claude|anthropic|copilot|cursor|codex|chatgpt|openai|gemini|devin|windsurf|aider|bot)\b/i,
    reason: 'an AI co-author or author trailer',
  },
  {
    pattern: /noreply@anthropic\.com|@users\.noreply\.(?:anthropic|openai)\.com/i,
    reason: 'a vendor no-reply e-mail address',
  },
  {
    pattern: /generated\s+with\s+[^\n]{0,40}\b(?:claude|ai|copilot|cursor|codex|gemini)\b/i,
    reason: 'a "Generated with …" attribution line',
  },
  {
    pattern: /claude\.com\/claude-code|claude\.ai\/code/i,
    reason: 'a Claude Code link',
  },
  {
    pattern:
      /\b(?:assisted|authored|written|created|produced)\s+by\s+(?:an?\s+)?(?:ai|claude|anthropic|copilot|cursor|codex|gemini|llm)\b/i,
    reason: 'an "authored by AI" phrase',
  },
  {
    pattern: /🤖|\u{1F916}/u,
    reason: 'a robot emoji',
  },
];

function allow() {
  process.exit(0);
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    const timer = setTimeout(() => resolve(raw), 5_000);
    timer.unref?.();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(raw);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(raw);
    });
  });
}

// `git commit`, `git -c foo=bar commit`, `git -C path commit`, and the same for tag/merge/revert.
const messageCommandPattern =
  /\bgit\b(?:\s+-[^\s]+(?:\s+[^\s-][^\s]*)?)*\s+(commit|tag|merge|revert)\b/i;
const pushPattern = /\bgit\b(?:\s+-[^\s]+(?:\s+[^\s-][^\s]*)?)*\s+push\b/i;
const noVerifyPattern = /(?:^|\s)(?:--no-verify|--no-gpg-sign)(?:\s|$|=)/i;
const forcePushPattern = /(?:^|\s)(?:--force|-f|\+[\w./-]+:)(?!-with-lease)/;

const payloadRaw = await readStdin();

let payload;
try {
  payload = JSON.parse(payloadRaw);
} catch {
  allow(); // Unparseable payload is not the developer's fault — never block on it.
}

if (payload?.tool_name !== 'Bash') {
  allow();
}

const command = payload?.tool_input?.command;
if (typeof command !== 'string' || !/\bgit\b/.test(command)) {
  allow();
}

// Flag detection must ignore anything inside the commit message itself. A message that
// legitimately discusses `--no-verify` or `--force` — a commit documenting this very hook,
// for instance — is not an attempt to pass the flag. Attribution checks still run against
// the full command, because there the message content is exactly what matters.
const withoutQuotedText = command
  .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\s*$/gm, ' ') // heredoc bodies
  .replace(/"(?:[^"\\]|\\[\s\S])*"/g, ' ')
  .replace(/'(?:[^'\\]|\\[\s\S])*'/g, ' ');

const isMessageCommand = messageCommandPattern.test(command);
const isPush = pushPattern.test(command);

if ((isMessageCommand || isPush) && noVerifyPattern.test(withoutQuotedText)) {
  block(
    'Blocked by .claude/hooks/guard-git-commit.mjs: --no-verify / --no-gpg-sign is not allowed.\n' +
      'It bypasses the .githooks/commit-msg guard that keeps AI attribution out of history.\n' +
      'Fix the underlying hook failure instead of skipping the hook.',
  );
}

if (isPush && forcePushPattern.test(withoutQuotedText)) {
  block(
    'Blocked by .claude/hooks/guard-git-commit.mjs: force push is not allowed.\n' +
      'It rewrites published history. Ask the repository owner and let them run it.',
  );
}

if (isMessageCommand) {
  for (const { pattern, reason } of attributionPatterns) {
    if (pattern.test(command)) {
      block(
        `Blocked by .claude/hooks/guard-git-commit.mjs: the message contains ${reason}.\n` +
          'LEX OS commit messages must carry no AI attribution of any kind — see CLAUDE.md §0.1.\n' +
          "Rewrite it as a plain message in the repository's style: short imperative subject, " +
          'optional body explaining why. No trailers, no links, no emoji.',
      );
    }
  }
}

allow();
