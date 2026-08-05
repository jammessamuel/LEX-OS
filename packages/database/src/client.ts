import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from './generated/prisma/client.js';

export interface TransactionOptions {
  maxWaitMs?: number;
  timeoutMs?: number;
}

export interface ConnectionPoolOptions {
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export type TransactionClient = Prisma.TransactionClient;

export function createPrismaClient(
  connectionString: string,
  poolOptions: ConnectionPoolOptions = {},
): PrismaClient {
  if (connectionString.trim().length === 0) {
    throw new Error('A non-empty PostgreSQL connection string is required.');
  }

  const adapter = new PrismaPg({ connectionString, ...poolOptions });
  return new PrismaClient({ adapter });
}

export async function withTransaction<T>(
  client: PrismaClient,
  operation: (transaction: TransactionClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  return client.$transaction(operation, {
    maxWait: options.maxWaitMs ?? 5_000,
    timeout: options.timeoutMs ?? 10_000,
  });
}
