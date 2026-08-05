import { FileIntakeError } from './file-intake-error.js';

const pathLikePattern = /[/\\]|(^|[.])[.](?:[.]|$)/u;
const unsafeDisplayCharacters = new Set(['<', '>', ':', '"', '|', '?', '*']);

export interface SafeFilename {
  displayName: string;
  extension: string;
  title: string;
}

export function sanitizeFilename(input: string): SafeFilename {
  if (input.length === 0 || input.includes('\0') || pathLikePattern.test(input)) {
    throw invalidFilename();
  }

  const normalized = input.normalize('NFKC');
  const safeCharacters = Array.from(normalized, (character) => {
    const codePoint = character.codePointAt(0);
    return (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) ||
      unsafeDisplayCharacters.has(character)
      ? '_'
      : character;
  }).join('');
  const displayName = safeCharacters
    .replace(/\s+/gu, ' ')
    .replace(/[. ]+$/gu, '')
    .trim();

  if (displayName.length === 0 || Buffer.byteLength(displayName, 'utf8') > 255) {
    throw invalidFilename();
  }

  const separator = displayName.lastIndexOf('.');
  if (separator < 1 || separator === displayName.length - 1) {
    throw new FileIntakeError(
      'INVALID_EXTENSION',
      400,
      'INVALID_FILE_EXTENSION',
      'A extensão do arquivo é inválida.',
    );
  }

  const extension = displayName.slice(separator + 1).toLowerCase();
  if (!/^[a-z0-9]{1,10}$/u.test(extension)) {
    throw new FileIntakeError(
      'INVALID_EXTENSION',
      400,
      'INVALID_FILE_EXTENSION',
      'A extensão do arquivo é inválida.',
    );
  }

  return {
    displayName,
    extension,
    title: displayName.slice(0, separator),
  };
}

function invalidFilename(): FileIntakeError {
  return new FileIntakeError(
    'INVALID_FILENAME',
    400,
    'INVALID_FILE_NAME',
    'O nome do arquivo é inválido.',
  );
}
