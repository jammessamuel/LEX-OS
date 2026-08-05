import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { NestFactory } from '@nestjs/core';
import { loadEnvironmentFileIfPresent, loadRuntimeConfig } from '@lex-os/config';
import { StructuredLogger } from '@lex-os/shared';

import { AppModule } from './app.module.js';
import { configureHttpPlatform } from './http/http-platform.js';
import { getRequestContext } from './observability/request-context.js';

async function bootstrap(): Promise<void> {
  loadEnvironmentFileIfPresent(fileURLToPath(new URL('../../../.env', import.meta.url)));
  const config = loadRuntimeConfig();
  const logger = new StructuredLogger({
    service: 'lex-os-api',
    level: config.service.logLevel,
    defaultCorrelationId: randomUUID(),
    contextProvider: getRequestContext,
  });
  const app = await NestFactory.create(AppModule, { logger });
  configureHttpPlatform(app, config);
  app.enableShutdownHooks();
  await app.listen(config.service.apiPort, '0.0.0.0');
  logger.log('api_started', { port: config.service.apiPort });
}

void bootstrap().catch((error: unknown) => {
  const logger = new StructuredLogger({
    service: 'lex-os-api',
    level: 'error',
    defaultCorrelationId: randomUUID(),
  });
  logger.error('api_bootstrap_failed', error);
  process.exitCode = 1;
});
