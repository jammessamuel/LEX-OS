import { AsyncLocalStorage } from 'node:async_hooks';

import type { LogContext } from '@lex-os/shared';

import type { ActorContext } from '../auth/actor-context.js';

const requestContextStorage = new AsyncLocalStorage<LogContext>();

export function runWithRequestContext(context: LogContext, callback: () => void): void {
  requestContextStorage.run(context, callback);
}

export function getRequestContext(): LogContext | undefined {
  return requestContextStorage.getStore();
}

export function setAuthenticatedRequestContext(actor: ActorContext): void {
  const context = requestContextStorage.getStore();

  if (context !== undefined) {
    context.userId = actor.userId;
    context.organizationId = actor.organizationId;
    context.sessionId = actor.sessionId;
  }
}
