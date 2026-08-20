import { createHash } from 'node:crypto';

import { HttpStatus, Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { createClient, type RedisClientType } from 'redis';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { ApiException } from '../http/api-exception.js';

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class LoginAttemptService implements OnModuleDestroy {
  readonly #client: RedisClientType;
  readonly #limit: number;
  readonly #windowSeconds: number;
  #connection: Promise<RedisClientType> | undefined;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.#limit = config.authentication.loginAttemptLimit;
    this.#windowSeconds = config.authentication.loginAttemptWindowSeconds;
    this.#client = createClient({
      password: config.redis.password,
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: config.service.dependencyTimeoutMs,
        reconnectStrategy: false,
      },
    });
    this.#client.on('error', () => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.#client.isOpen) {
      this.#client.destroy();
    }
  }

  async assertAllowed(organizationSlug: string, email: string, clientIp: string): Promise<void> {
    const key = this.#key(organizationSlug, email, clientIp);
    const count = await this.#redisOperation(async (client) =>
      Number((await client.get(key)) ?? 0),
    );

    if (count >= this.#limit) {
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        'Muitas tentativas de acesso. Tente novamente mais tarde.',
      );
    }
  }

  async recordFailure(organizationSlug: string, email: string, clientIp: string): Promise<void> {
    const key = this.#key(organizationSlug, email, clientIp);
    await this.#redisOperation((client) =>
      client.eval(incrementScript, {
        keys: [key],
        arguments: [String(this.#windowSeconds)],
      }),
    );
  }

  async clear(organizationSlug: string, email: string, clientIp: string): Promise<void> {
    const key = this.#key(organizationSlug, email, clientIp);
    await this.#redisOperation((client) => client.del(key));
  }

  /**
   * A contagem e chaveada pelo slug, nao pelo identificador resolvido: o slug e o que o
   * cliente varia, e existe antes de sabermos se ha escritorio por tras dele. Chavear pelo
   * identificador deixaria sem freio a tentativa contra um escritorio inexistente.
   */
  #key(organizationSlug: string, email: string, clientIp: string): string {
    const fingerprint = createHash('sha256')
      .update(`${organizationSlug}\u0000${email}\u0000${clientIp}`)
      .digest('hex');
    return `auth:login:${fingerprint}`;
  }

  async #connectedClient(): Promise<RedisClientType> {
    if (this.#client.isReady) {
      return this.#client;
    }

    this.#connection ??= this.#client.connect().then(() => this.#client);

    try {
      return await this.#connection;
    } catch (error: unknown) {
      this.#connection = undefined;
      throw error;
    }
  }

  async #redisOperation<T>(operation: (client: RedisClientType) => Promise<T>): Promise<T> {
    try {
      return await operation(await this.#connectedClient());
    } catch {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_PROTECTION_UNAVAILABLE',
        'Autenticação temporariamente indisponível.',
      );
    }
  }
}
