import { Injectable } from '@nestjs/common';

export interface MetricsSnapshot {
  service: 'lex-os-api';
  uptimeSeconds: number;
  requests: {
    total: number;
    byStatusClass: Readonly<Record<string, number>>;
    averageDurationMs: number;
  };
  memoryBytes: {
    residentSet: number;
    heapUsed: number;
  };
  processing: {
    /**
     * Jobs persistidos no PostgreSQL que não puderam ser publicados no Redis.
     *
     * O reconciliador os republica, portanto um valor não nulo representa trabalho
     * recuperável. Crescimento contínuo indica fila inacessível e entradas aguardando a
     * reconciliação em vez de processamento imediato.
     */
    deferredEnqueues: number;
  };
}

@Injectable()
export class MetricsService {
  readonly #startedAt = Date.now();
  readonly #byStatusClass = new Map<string, number>();
  #requestCount = 0;
  #totalDurationMs = 0;
  #deferredEnqueues = 0;

  recordRequest(statusCode: number, durationMs: number): void {
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    this.#requestCount += 1;
    this.#totalDurationMs += durationMs;
    this.#byStatusClass.set(statusClass, (this.#byStatusClass.get(statusClass) ?? 0) + 1);
  }

  recordDeferredEnqueue(): void {
    this.#deferredEnqueues += 1;
  }

  snapshot(): MetricsSnapshot {
    const memory = process.memoryUsage();

    return {
      service: 'lex-os-api',
      uptimeSeconds: Math.floor((Date.now() - this.#startedAt) / 1_000),
      requests: {
        total: this.#requestCount,
        byStatusClass: Object.fromEntries(this.#byStatusClass),
        averageDurationMs:
          this.#requestCount === 0
            ? 0
            : Number((this.#totalDurationMs / this.#requestCount).toFixed(3)),
      },
      memoryBytes: {
        residentSet: memory.rss,
        heapUsed: memory.heapUsed,
      },
      processing: {
        deferredEnqueues: this.#deferredEnqueues,
      },
    };
  }
}
