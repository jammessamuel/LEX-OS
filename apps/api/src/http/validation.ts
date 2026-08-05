import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { ApiException, type ApiErrorDetail } from './api-exception.js';

function flattenValidationErrors(
  errors: readonly ValidationError[],
  parent = '',
): ApiErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent.length === 0 ? error.property : `${parent}.${error.property}`;
    const ownDetails = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      field,
      code,
      message,
    }));
    return [...ownDetails, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: false,
    exceptionFactory: (errors) =>
      new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Dados inválidos.',
        flattenValidationErrors(errors),
      ),
  });
}
