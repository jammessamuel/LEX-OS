import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { loadEnvironmentFileIfPresent, loadRuntimeConfig } from '@lex-os/config';
import { StructuredLogger } from '@lex-os/shared';

import { AppModule } from './app.module.js';
import { clearReadinessSignal, createReadinessSignal } from './readiness.js';

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const keepAliveTimer = setInterval(() => undefined, 60 * 60 * 1_000);

    const shutdown = (): void => {
      clearInterval(keepAliveTimer);
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      resolve();
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

async function bootstrap(): Promise<void> {
  loadEnvironmentFileIfPresent(resolve(__dirname, '../../../.env'));
  const config = loadRuntimeConfig();
  const correlationId = randomUUID();
  const logger = new StructuredLogger({
    service: 'lex-os-worker',
    level: config.service.logLevel,
    defaultCorrelationId: correlationId,
  });
  await clearReadinessSignal(config.service.workerReadyFile);
  const app = await NestFactory.createApplicationContext(AppModule, { logger });

  try {
    await createReadinessSignal(config.service.workerReadyFile);
    logger.log('worker_ready', { ready_file: config.service.workerReadyFile });
    await waitForShutdown();
  } finally {
    await clearReadinessSignal(config.service.workerReadyFile);
    await app.close();
    logger.log('worker_stopped');
  }
}

void bootstrap().catch((error: unknown) => {
  const logger = new StructuredLogger({
    service: 'lex-os-worker',
    level: 'error',
    defaultCorrelationId: randomUUID(),
  });
  logger.error('worker_bootstrap_failed', error);
  process.exitCode = 1;
});
