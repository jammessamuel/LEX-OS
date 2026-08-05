import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { createClient } from 'redis';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';

type DependencyName = 'minio' | 'postgresql' | 'redis';
type DependencyStatus = 'down' | 'up';

export interface ReadinessReport {
  status: 'down' | 'up';
  dependencies: Readonly<Record<DependencyName, DependencyStatus>>;
  checkedAt: string;
}

async function bounded<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Dependency check timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly database: DatabaseService,
  ) {}

  async checkReadiness(): Promise<ReadinessReport> {
    const [postgresql, redis, minio] = await Promise.all([
      this.#checkPostgresql(),
      this.#checkRedis(),
      this.#checkMinio(),
    ]);
    const dependencies = { postgresql, redis, minio } as const;

    return {
      status: Object.values(dependencies).every((status) => status === 'up') ? 'up' : 'down',
      dependencies,
      checkedAt: new Date().toISOString(),
    };
  }

  async #checkPostgresql(): Promise<DependencyStatus> {
    try {
      await bounded(
        this.database.client.$queryRaw`SELECT 1`,
        this.config.service.dependencyTimeoutMs,
      );
      return 'up';
    } catch {
      return 'down';
    }
  }

  async #checkRedis(): Promise<DependencyStatus> {
    const client = createClient({
      password: this.config.redis.password,
      socket: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        connectTimeout: this.config.service.dependencyTimeoutMs,
        reconnectStrategy: false,
      },
    });
    client.on('error', () => undefined);

    try {
      await bounded(client.connect(), this.config.service.dependencyTimeoutMs);
      await bounded(client.ping(), this.config.service.dependencyTimeoutMs);
      return 'up';
    } catch {
      return 'down';
    } finally {
      if (client.isOpen) {
        client.destroy();
      }
    }
  }

  async #checkMinio(): Promise<DependencyStatus> {
    try {
      const response = await fetch(
        new URL('/minio/health/ready', this.config.objectStorage.endpoint),
        { signal: AbortSignal.timeout(this.config.service.dependencyTimeoutMs) },
      );

      return response.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
