import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { writeStructuredLog } from '@lex-os/shared';
import type { Request, Response } from 'express';

import { ApiException } from './api-exception.js';

interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details: readonly unknown[];
  requestId: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestIdHeader = response.getHeader('x-request-id');
    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : 'unavailable';
    const envelope = this.#toEnvelope(exception, requestId);

    if (
      !(exception instanceof ApiException) &&
      !(exception instanceof HttpException) &&
      !(exception instanceof ThrottlerException)
    ) {
      const correlationIdHeader = response.getHeader('x-correlation-id');
      writeStructuredLog({
        level: 'error',
        service: 'lex-os-api',
        message: 'http_request_failed_unexpectedly',
        correlationId: typeof correlationIdHeader === 'string' ? correlationIdHeader : requestId,
        requestId,
        metadata: { error: exception },
      });
    }

    response.status(envelope.statusCode).json(envelope);
  }

  #toEnvelope(exception: unknown, requestId: string): ErrorEnvelope {
    if (exception instanceof ApiException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.safeMessage,
        details: exception.details,
        requestId,
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'RATE_LIMITED',
        message: 'Muitas solicitações. Tente novamente mais tarde.',
        details: [],
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: statusCode === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'HTTP_ERROR',
        message:
          statusCode === HttpStatus.NOT_FOUND
            ? 'Recurso não encontrado.'
            : 'Não foi possível concluir a solicitação.',
        details: [],
        requestId,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor.',
      details: [],
      requestId,
    };
  }
}
