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
     * Jobs that were committed to PostgreSQL but could not be published to Redis.
     *
     * The stale-job reconciler republishes them, so a non-zero value is recoverable rather
     * than lost work. A value that keeps climbing means the queue is unreachable and every
     * upload is waiting on reconciliation instead of being processed promptly.
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
