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
  permissions: string[];
}

export interface CaseResponsible {
  id: string;
  name: string;
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
  responsible: CaseResponsible | null;
  processingCostLimitAmount: string;
  processingCostSpentAmount: string;
  processingCostReservedAmount: string;
  processingCostCurrency: string;
  processingBudgetStatus: 'ACTIVE' | 'LIMIT_REACHED';
  processingLimitReachedAt: string | null;
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

export interface Person extends ParticipantPerson {
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonCaseParticipation {
  id: string;
  role: ParticipantRole;
  side: ParticipantSide | null;
  isClient: boolean;
}

export interface PersonCase {
  case: CaseSummary;
  participations: PersonCaseParticipation[];
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

export const processingJobTypes = [
  'OCR',
  'TRANSCRIPTION',
  'DOCUMENT_CLASSIFICATION',
  'ENTITY_EXTRACTION',
  'SUMMARY',
  'EMBEDDING',
  'TIMELINE_GENERATION',
  'CHECKLIST_ANALYSIS',
  'DUPLICATE_DETECTION',
  'FILE_VALIDATION',
  'VIRUS_SCAN',
] as const;

export const processingJobStatuses = [
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'CANCELLED',
] as const;

export type ProcessingJobType = (typeof processingJobTypes)[number];
export type ProcessingJobStatus = (typeof processingJobStatuses)[number];

export interface ProcessingJob {
  id: string;
  caseId: string | null;
  fileId: string | null;
  documentId: string | null;
  jobType: ProcessingJobType;
  status: ProcessingJobStatus;
  priority: number;
  attempts: number;
  version: number;
  provider: string | null;
  modelName: string | null;
  modelVersion: string | null;
  reservedCostAmount: string;
  costAmount: string | null;
  costCurrency: string;
  outputMetadata: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const extractionTypes = [
  'OCR',
  'TRANSCRIPTION',
  'CLASSIFICATION',
  'SUMMARY',
  'ENTITY_EXTRACTION',
  'IMAGE_ANALYSIS',
  'TIMELINE_ANALYSIS',
  'CHECKLIST_ANALYSIS',
] as const;

export type ExtractionType = (typeof extractionTypes)[number];

export interface ExtractedEntity {
  id: string;
  entityType: string;
  normalizedValue: string;
  originalValue: string;
  pageNumber: number | null;
  startOffset: number | null;
  endOffset: number | null;
  confidenceScore: number | null;
  linkedPersonId: string | null;
  metadata: unknown;
  confirmedByUser: boolean;
  confirmedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

/** Execução imutável: reprocessar cria outra em vez de sobrescrever esta. */
export interface Extraction {
  id: string;
  documentId: string;
  extractionType: ExtractionType;
  provider: string;
  modelName: string;
  modelVersion: string | null;
  executionId: string;
  status: string;
  rawText: string | null;
  structuredData: unknown;
  confidenceScore: number | null;
  processingTimeMs: number | null;
  promptVersion: string | null;
  errorCode: string | null;
  entities: ExtractedEntity[];
  createdAt: string;
}

export const datePrecisions = ['EXACT', 'DAY', 'MONTH', 'YEAR', 'APPROXIMATE', 'UNKNOWN'] as const;
export const importances = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

export type DatePrecision = (typeof datePrecisions)[number];
export type Importance = (typeof importances)[number];

export interface TimelineExtractionSummary {
  id: string;
  provider: string;
  modelName: string;
  modelVersion: string | null;
  promptVersion: string | null;
  createdAt: string;
}

/** Evento de cronologia: nasce de IA não confirmado; a confirmação preserva a origem. */
export interface TimelineEvent {
  id: string;
  caseId: string;
  eventType: string;
  title: string;
  description: string;
  occurredAt: string | null;
  datePrecision: DatePrecision;
  importance: Importance;
  sourceType: string;
  sourceId: string | null;
  sourceLocator: Record<string, unknown> | null;
  extraction: TimelineExtractionSummary | null;
  confidenceScore: number | null;
  createdByActorType: string;
  confirmedByUser: boolean;
  confirmedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const checklistItemStatuses = [
  'MISSING',
  'RECEIVED',
  'INVALID',
  'EXPIRED',
  'ILLEGIBLE',
  'AWAITING_VALIDATION',
  'VALIDATED',
  'NOT_APPLICABLE',
] as const;

export const caseChecklistStatuses = ['IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED'] as const;

export type ChecklistItemStatus = (typeof checklistItemStatuses)[number];
export type CaseChecklistStatus = (typeof caseChecklistStatuses)[number];

export interface ChecklistTemplateItem {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  documentTypeId: string | null;
  documentTypeCode: string | null;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  legalArea: string;
  caseType: string;
  version: number;
  items: ChecklistTemplateItem[];
}

export interface CaseChecklistItem {
  id: string;
  caseChecklistId: string;
  templateItemId: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  status: ChecklistItemStatus;
  documentId: string | null;
  validatedById: string | null;
  validatedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Instantâneo versionado: o checklist do caso não muda se o template for alterado depois. */
export interface CaseChecklist {
  id: string;
  caseId: string;
  templateId: string;
  templateVersion: number;
  status: CaseChecklistStatus;
  items: CaseChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export const taskStatuses = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const taskSourceTypes = [
  'USER',
  'AI_CHECKLIST',
  'AI_DOCUMENT_ANALYSIS',
  'COURT_MOVEMENT',
  'WORKFLOW',
] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskSourceType = (typeof taskSourceTypes)[number];

export interface CaseTask {
  id: string;
  caseId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  status: TaskStatus;
  priority: Priority;
  assignedToId: string | null;
  createdById: string | null;
  dueAt: string | null;
  completedAt: string | null;
  sourceType: TaskSourceType;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignableUser {
  id: string;
  name: string;
}

export interface DashboardSummary {
  cases: { total: number; open: number; highPriority: number; processingLimitReached: number };
  documents: { total: number; processing: number; needsReview: number; failed: number };
  tasks: { open: number; overdue: number };
  processing: { active: number; failed: number };
  asOf: string;
}

export type SearchMode = 'HYBRID' | 'LEXICAL' | 'SEMANTIC';

export interface SearchCitation {
  caseId: string;
  documentId: string;
  extractionId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  contentHash: string;
}

export interface SearchResult {
  chunkId: string;
  excerpt: string;
  matchedBy: SearchMode;
  score: number;
  citation: SearchCitation;
}

export interface SearchResponse {
  status: 'RESULTS' | 'INSUFFICIENT_EVIDENCE';
  mode: SearchMode;
  resultCount: number;
  results: SearchResult[];
}

export interface GroundedClaim {
  text: string;
  citations: SearchCitation[];
}

export interface GroundedAnswerResponse {
  status: 'ANSWER' | 'INSUFFICIENT_EVIDENCE';
  machineGenerated: true;
  disclaimer: string;
  answer: string | null;
  claims: GroundedClaim[];
  model: {
    provider: string;
    modelName: string;
    modelVersion: string;
    promptVersion: string;
    executionId: string;
    costAmount: string;
    costCurrency: string;
  } | null;
}

export interface AuditLog {
  id: string;
  actorType: 'USER' | 'SYSTEM' | 'AI' | 'INTEGRATION';
  actorId: string | null;
  actor: { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  correlationId: string | null;
  processingJobId: string | null;
  createdAt: string;
}

export const userStatuses = ['INVITED', 'ACTIVE', 'BLOCKED', 'INACTIVE'] as const;
export type UserStatus = (typeof userStatuses)[number];

export interface UserRoleSummary {
  id: string;
  name: string;
  code: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  lastLoginAt: string | null;
  roles: UserRoleSummary[];
}

export interface PendingInvitation {
  id: string;
  user: Pick<ManagedUser, 'id' | 'name' | 'email' | 'status'>;
  expiresAt: string;
}

/** O token vem só aqui, e só uma vez: o banco guarda apenas o hash. */
export interface CreatedInvitation extends PendingInvitation {
  token: string;
}

export interface RolePermission {
  code: string;
  description: string;
}

/** `grantable` falso é devolvido de propósito: a tela explica a ausência em vez de escondê-la. */
export interface AssignableRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
  grantable: boolean;
  permissions: RolePermission[];
}
