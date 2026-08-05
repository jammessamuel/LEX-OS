import type { JobStatus } from '@lex-os/database';

const allowedTransitions = {
  QUEUED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'RETRYING', 'FAILED', 'CANCELLED'],
  RETRYING: ['PROCESSING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
} as const satisfies Record<JobStatus, readonly JobStatus[]>;

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return (allowedTransitions[from] as readonly JobStatus[]).includes(to);
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid processing job transition: ${from} -> ${to}.`);
  }
}
