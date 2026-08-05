import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { createPrismaClient, type PrismaClient } from '@lex-os/database';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

function buildConnectionString(config: RuntimeConfig['database']): string {
  const url = new URL('postgresql://localhost');
  url.hostname = config.host;
  url.port = String(config.port);
  url.pathname = `/${encodeURIComponent(config.name)}`;
  url.username = config.user;
  url.password = config.password;
  url.searchParams.set('schema', 'public');
  url.searchParams.set('sslmode', config.ssl ? 'require' : 'disable');
  return url.toString();
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.client = createPrismaClient(buildConnectionString(config.database), {
      connectionTimeoutMillis: config.service.dependencyTimeoutMs,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
