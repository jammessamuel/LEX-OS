import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import { writeStructuredLog } from '@lex-os/shared';
import type { NextFunction, Request, Response } from 'express';

import { MetricsService } from './metrics.service.js';
import { runWithRequestContext } from './request-context.js';

const identifierPattern = /^[a-zA-Z0-9._:-]{1,128}$/u;

function safeHeaderIdentifier(value: string | string[] | undefined): string | undefined {
  const identifier = Array.isArray(value) ? value[0] : value;

  if (identifier === undefined || !identifierPattern.test(identifier)) {
    return undefined;
  }

  return identifier;
}

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = safeHeaderIdentifier(request.headers['x-request-id']) ?? randomUUID();
    const correlationId = safeHeaderIdentifier(request.headers['x-correlation-id']) ?? requestId;
    const startedAt = process.hrtime.bigint();
    const context = { requestId, correlationId };

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.metricsService.recordRequest(response.statusCode, durationMs);
      writeStructuredLog({
        level: response.statusCode >= 500 ? 'error' : 'info',
        service: 'lex-os-api',
        message: 'http_request_completed',
        requestId,
        correlationId,
        metadata: {
          method: request.method,
          path: request.originalUrl.split('?')[0],
          status_code: response.statusCode,
          duration_ms: Number(durationMs.toFixed(3)),
          ...('userId' in context ? { user_id: context.userId } : {}),
          ...('organizationId' in context ? { organization_id: context.organizationId } : {}),
        },
      });
    });

    runWithRequestContext(context, next);
  }
}
