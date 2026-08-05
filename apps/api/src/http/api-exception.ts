import { HttpException, type HttpStatus } from '@nestjs/common';

export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    readonly safeMessage: string,
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(safeMessage, status);
  }
}
