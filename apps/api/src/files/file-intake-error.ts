export type FileRejectionReason =
  | 'CORRUPTED_FILE'
  | 'EMPTY_FILE'
  | 'FILE_COUNT_LIMIT'
  | 'FILE_REQUIRED'
  | 'FILE_TOO_LARGE'
  | 'INFECTED_FILE'
  | 'INVALID_EXTENSION'
  | 'INVALID_FILENAME'
  | 'INVALID_MULTIPART'
  | 'MIME_MISMATCH'
  | 'STORAGE_UNAVAILABLE'
  | 'TYPE_NOT_ALLOWED';

export class FileIntakeError extends Error {
  constructor(
    readonly reason: FileRejectionReason,
    readonly statusCode: number,
    readonly publicCode: string,
    readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = 'FileIntakeError';
  }
}
