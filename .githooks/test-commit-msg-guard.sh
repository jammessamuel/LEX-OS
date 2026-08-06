#!/bin/sh
# Autoteste das proteções de mensagem descritas na seção 0.1 de CLAUDE.md.
#
# Executa na CI ou manualmente com: sh .githooks/test-commit-msg-guard.sh
# Exercita os ganchos commit-msg e PreToolUse para impedir que uma regressão chegue ao histórico.

set -u

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
checks=0

# expect_msg <saída-esperada> <rótulo> <mensagem>
expect_msg() {
  expected="$1"
  label="$2"
  printf '%b' "$3" > "$work/message"
  sh "$root/.githooks/commit-msg" "$work/message" >/dev/null 2>&1
  actual=$?
  checks=$((checks + 1))
  if [ "$actual" -ne "$expected" ]; then
    printf 'FAIL  commit-msg  %s (expected %s, got %s)\n' "$label" "$expected" "$actual"
    failures=$((failures + 1))
  else
    printf 'ok    commit-msg  %s\n' "$label"
  fi
}

# expect_hook <saída-esperada> <rótulo> <comando-bash-em-json>
expect_hook() {
  expected="$1"
  label="$2"
  printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$3" \
    | node "$root/.claude/hooks/guard-git-commit.mjs" >/dev/null 2>&1
  actual=$?
  checks=$((checks + 1))
  if [ "$actual" -ne "$expected" ]; then
    printf 'FAIL  pretooluse  %s (expected %s, got %s)\n' "$label" "$expected" "$actual"
    failures=$((failures + 1))
  else
    printf 'ok    pretooluse  %s\n' "$label"
  fi
}

# --- Gancho commit-msg do Git ------------------------------------------------------

expect_msg 0 'plain message' 'feat: add processing progress route\n'
expect_msg 1 'claude co-author' 'fix: bug\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n'
expect_msg 1 'copilot sign-off' 'refactor: tidy\n\nSigned-off-by: Copilot <bot@github.com>\n'
expect_msg 1 'generated-with line' 'chore: x\n\nGenerated with [Claude Code](https://claude.com/claude-code)\n'
expect_msg 1 'vendor no-reply' 'chore: x\n\nCo-authored-by: a <a@users.noreply.anthropic.com>\n'
expect_msg 1 'authored-by-ai phrase' 'chore: x\n\nWritten by Claude.\n'
expect_msg 1 'robot emoji' 'chore: cleanup \360\237\244\226\n'
expect_msg 0 'mentions the tool without claiming authorship' \
  'chore: add Claude Code decision harness\n'
expect_msg 0 'attribution inside a comment line' \
  'docs: note\n# Co-Authored-By: Claude <noreply@anthropic.com>\n'

# --- Gancho PreToolUse do Claude Code ----------------------------------------------

if command -v node >/dev/null 2>&1; then
  expect_hook 0 'plain commit' 'git commit -m \"feat: add route\"'
  expect_hook 2 'claude co-author' \
    'git commit -m \"fix\\n\\nCo-Authored-By: Claude <noreply@anthropic.com>\"'
  expect_hook 2 'generated-with line' \
    'git commit -m \"x\\n\\nGenerated with [Claude Code](https://claude.com/claude-code)\"'
  expect_hook 2 'no-verify bypass' 'git commit --no-verify -m \"x\"'
  expect_hook 2 'force push' 'git push --force origin main'
  expect_hook 0 'ordinary push' 'git push origin main'
  expect_hook 0 'mentions the tool without claiming authorship' \
    'git commit -m \"chore: add Claude Code decision harness\"'
  expect_hook 0 'unrelated command' 'pnpm lint'
  # A mensagem pode citar as opções sem tentar passá-las ao comando.
  expect_hook 0 'flag named inside the message, not passed' \
    'git commit -m \"docs: explica por que --no-verify e --force sao bloqueados\"'
  expect_hook 2 'flag passed after a message that mentions it' \
    'git commit -m \"docs: sobre --no-verify\" --no-verify'
else
  printf 'skip  pretooluse  node is unavailable\n'
fi

printf '\n%s checks, %s failures\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
