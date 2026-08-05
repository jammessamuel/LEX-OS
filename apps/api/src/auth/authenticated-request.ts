import type { Request } from 'express';

import type { ActorContext } from './actor-context.js';

export interface AuthenticatedRequest extends Request {
  actor?: ActorContext;
  cookies: Readonly<Record<string, string | undefined>>;
}
