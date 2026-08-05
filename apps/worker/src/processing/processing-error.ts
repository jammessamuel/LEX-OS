export class RetryableProcessingError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = 'RetryableProcessingError';
  }
}

export class PermanentProcessingError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = 'PermanentProcessingError';
  }
}
