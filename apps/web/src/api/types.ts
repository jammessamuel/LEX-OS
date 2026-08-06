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

export const participantRoles = [
  'autor',
  'reu',
  'reclamante',
  'reclamado',
  'testemunha',
  'perito',
  'juiz',
  'advogado',
  'terceiro_interessado',
  'representante_legal',
] as const;

export const participantSides = ['polo_ativo', 'polo_passivo', 'terceiro', 'neutro'] as const;
export const personTypes = ['INDIVIDUAL', 'COMPANY', 'GOVERNMENT_ENTITY'] as const;

export type ParticipantRole = (typeof participantRoles)[number];
export type ParticipantSide = (typeof participantSides)[number];
export type PersonType = (typeof personTypes)[number];

export interface ParticipantPerson {
  id: string;
  personType: PersonType;
  fullName: string;
  tradeName: string | null;
}

export interface Participant {
  id: string;
  caseId: string;
  role: ParticipantRole;
  side: ParticipantSide | null;
  isClient: boolean;
  person: ParticipantPerson;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFileSummary {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  virusScanStatus: string;
  status: string;
}

export interface DocumentTypeSummary {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface CaseDocument {
  id: string;
  caseId: string | null;
  fileId: string;
  documentTypeId: string | null;
  title: string;
  description: string | null;
  documentDate: string | null;
  issuer: string | null;
  recipient: string | null;
  classificationStatus: string;
  processingStatus: string;
  isOriginal: boolean;
  isSigned: boolean | null;
  isLegible: boolean | null;
  isDuplicate: boolean;
  file: DocumentFileSummary;
  documentType: DocumentTypeSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFile {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  virusScanStatus: string;
  status: string;
  duplicateOfFileId: string | null;
  createdAt: string;
}

export interface IntakeJob {
  id: string;
  jobType: string;
  status: string;
}

export interface AcceptedFileIntake {
  file: StoredFile;
  job: IntakeJob;
}

export interface RejectedFileIntake {
  fileIndex: number;
  code: string;
  message: string;
}

/** Resposta 202 do envio: o resultado parcial é o caso comum, não a exceção. */
export interface FileIntakeBatch {
  accepted: AcceptedFileIntake[];
  rejected: RejectedFileIntake[];
}
