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

/**
 * Escopo do contador. Separar as contagens importa: quem erra a senha e quem pede
 * redefinição são abusos diferentes, e somá-los faria um bloquear o outro.
 */
export type AttemptScope = 'login' | 'reset';

/**
 * Três pedidos de redefinição por hora, por identidade — não por IP.
 *
 * Contar por IP pareceria mais protetor e é pior: um escritório atrás de um único NAT teria
 * uma pessoa esquecida bloqueando a banca inteira. A identidade é o que o atacante precisa
 * variar, e é ela que o contador enxerga.
 */
const RESET_REQUEST_LIMIT = 3;
const RESET_REQUEST_WINDOW_SECONDS = 3_600;

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

  async assertAllowed(
    organizationSlug: string,
    email: string,
    clientIp: string,
    scope: AttemptScope = 'login',
  ): Promise<void> {
    const key = this.#key(organizationSlug, email, clientIp, scope);
    const count = await this.#redisOperation(async (client) =>
      Number((await client.get(key)) ?? 0),
    );

    if (count >= this.#limitFor(scope)) {
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        'Muitas tentativas de acesso. Tente novamente mais tarde.',
      );
    }
  }

  async recordFailure(
    organizationSlug: string,
    email: string,
    clientIp: string,
    scope: AttemptScope = 'login',
  ): Promise<void> {
    const key = this.#key(organizationSlug, email, clientIp, scope);
    await this.#redisOperation((client) =>
      client.eval(incrementScript, {
        keys: [key],
        arguments: [String(this.#windowFor(scope))],
      }),
    );
  }

  async clear(
    organizationSlug: string,
    email: string,
    clientIp: string,
    scope: AttemptScope = 'login',
  ): Promise<void> {
    const key = this.#key(organizationSlug, email, clientIp, scope);
    await this.#redisOperation((client) => client.del(key));
  }

  /**
   * A contagem e chaveada pelo slug, nao pelo identificador resolvido: o slug e o que o
   * cliente varia, e existe antes de sabermos se ha escritorio por tras dele. Chavear pelo
   * identificador deixaria sem freio a tentativa contra um escritorio inexistente.
   */
  #limitFor(scope: AttemptScope): number {
    return scope === 'login' ? this.#limit : RESET_REQUEST_LIMIT;
  }

  #windowFor(scope: AttemptScope): number {
    return scope === 'login' ? this.#windowSeconds : RESET_REQUEST_WINDOW_SECONDS;
  }

  #key(organizationSlug: string, email: string, clientIp: string, scope: AttemptScope): string {
    const fingerprint = createHash('sha256')
      .update(`${organizationSlug}\u0000${email}\u0000${clientIp}`)
      .digest('hex');
    return `auth:${scope}:${fingerprint}`;
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
