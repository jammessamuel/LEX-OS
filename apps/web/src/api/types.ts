/**
 * Espelho dos contratos de resposta expostos em /api/v1.
 *
 * Mantido à mão de propósito: o cliente web nunca importa código do servidor, para que a
 * fronteira HTTP continue sendo a única dependência entre os dois. Ao alterar um DTO da
 * API, atualize aqui e no teste que cobre o mapeamento.
 */

export const caseStatuses = [
  'INTAKE',
  'DOCUMENT_COLLECTION',
  'UNDER_ANALYSIS',
  'READY_TO_FILE',
  'FILED',
  'ACTIVE',
  'SUSPENDED',
  'SETTLED',
  'CLOSED',
  'ARCHIVED',
] as const;

export const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const confidentialityLevels = ['STANDARD', 'CONFIDENTIAL', 'RESTRICTED'] as const;

export type CaseStatus = (typeof caseStatuses)[number];
export type Priority = (typeof priorities)[number];
export type ConfidentialityLevel = (typeof confidentialityLevels)[number];

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedOrganization {
  id: string;
  tradeName: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
  organization: AuthenticatedOrganization;
}

export interface CaseSummary {
  id: string;
  internalCode: string;
  title: string;
  description: string | null;
  legalArea: string;
  caseType: string;
  status: CaseStatus;
  priority: Priority;
  confidentialityLevel: ConfidentialityLevel;
  responsibleUserId: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageInfo {
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPage<T> {
  data: T[];
  pageInfo: PageInfo;
}

export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details: ApiErrorDetail[];
  requestId: string;
}
