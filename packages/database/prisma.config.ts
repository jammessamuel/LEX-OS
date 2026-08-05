import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error: unknown) {
  if (!(
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  )) {
    throw error;
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(databaseUrl === undefined || databaseUrl.length === 0
    ? {}
    : { datasource: { url: databaseUrl } }),
});
