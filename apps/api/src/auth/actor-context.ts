export interface ActorContext {
  userId: string;
  organizationId: string;
  sessionId: string;
  permissions: ReadonlySet<string>;
}
