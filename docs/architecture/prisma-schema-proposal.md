# Initial Prisma schema proposal

**Status:** Implemented in Delivery 3; retained as the reviewed design record  
**Last updated:** 2026-08-05

## Purpose

This document records the proposal that was used to create the database implementation. The canonical executable schema is now [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma), and the generated/amended SQL is under [`packages/database/prisma/migrations`](../../packages/database/prisma/migrations). The schema block below is retained for design traceability and is not the runtime source of truth.

The model intentionally adds a few fields needed to satisfy the architectural invariants:

- duplicate linkage on files;
- execution/error provenance on extractions;
- human classifier/confirmation timestamps;
- source locators and extraction links for timeline events;
- snapshot fields for applied checklist items;
- embedding model/dimension metadata;
- optimistic version on processing jobs;
- optional processing-job link in audit logs.

These additions refine the requested model; they do not add out-of-MVP product features.

## Proposed schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  INACTIVE

  @@map("organization_status")
}

enum UserStatus {
  INVITED
  ACTIVE
  BLOCKED
  INACTIVE

  @@map("user_status")
}

enum PersonType {
  INDIVIDUAL
  COMPANY
  GOVERNMENT_ENTITY

  @@map("person_type")
}

enum CaseStatus {
  INTAKE
  DOCUMENT_COLLECTION
  UNDER_ANALYSIS
  READY_TO_FILE
  FILED
  ACTIVE
  SUSPENDED
  SETTLED
  CLOSED
  ARCHIVED

  @@map("case_status")
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT

  @@map("priority")
}

enum ConfidentialityLevel {
  STANDARD
  CONFIDENTIAL
  RESTRICTED

  @@map("confidentiality_level")
}

enum ParticipantSide {
  POLO_ATIVO  @map("polo_ativo")
  POLO_PASSIVO @map("polo_passivo")
  TERCEIRO    @map("terceiro")
  NEUTRO      @map("neutro")

  @@map("participant_side")
}

enum VirusScanStatus {
  PENDING
  PROCESSING
  CLEAN
  INFECTED
  ERROR

  @@map("virus_scan_status")
}

enum FileStatus {
  QUARANTINED
  VALIDATING
  AVAILABLE
  REJECTED
  FAILED

  @@map("file_status")
}

enum ClassificationStatus {
  PENDING
  PROCESSING
  CLASSIFIED
  NEEDS_REVIEW
  FAILED

  @@map("classification_status")
}

enum DocumentProcessingStatus {
  PENDING
  QUEUED
  PROCESSING
  COMPLETED
  NEEDS_REVIEW
  FAILED

  @@map("document_processing_status")
}

enum ExtractionType {
  OCR
  TRANSCRIPTION
  CLASSIFICATION
  SUMMARY
  ENTITY_EXTRACTION
  IMAGE_ANALYSIS
  TIMELINE_ANALYSIS
  CHECKLIST_ANALYSIS

  @@map("extraction_type")
}

enum ExtractionStatus {
  PROCESSING
  COMPLETED
  FAILED

  @@map("extraction_status")
}

enum DatePrecision {
  EXACT
  DAY
  MONTH
  YEAR
  APPROXIMATE
  UNKNOWN

  @@map("date_precision")
}

enum Importance {
  LOW
  NORMAL
  HIGH
  CRITICAL

  @@map("importance")
}

enum ActorType {
  USER
  SYSTEM
  AI
  INTEGRATION

  @@map("actor_type")
}

enum ChecklistStatus {
  MISSING
  RECEIVED
  INVALID
  EXPIRED
  ILLEGIBLE
  AWAITING_VALIDATION
  VALIDATED
  NOT_APPLICABLE

  @@map("checklist_status")
}

enum CaseChecklistStatus {
  IN_PROGRESS
  NEEDS_REVIEW
  COMPLETED

  @@map("case_checklist_status")
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  CANCELLED

  @@map("task_status")
}

enum TaskSourceType {
  USER
  AI_CHECKLIST
  AI_DOCUMENT_ANALYSIS
  COURT_MOVEMENT
  WORKFLOW

  @@map("task_source_type")
}

enum JobType {
  OCR
  TRANSCRIPTION
  DOCUMENT_CLASSIFICATION
  ENTITY_EXTRACTION
  SUMMARY
  EMBEDDING
  TIMELINE_GENERATION
  CHECKLIST_ANALYSIS
  DUPLICATE_DETECTION
  FILE_VALIDATION
  VIRUS_SCAN

  @@map("job_type")
}

enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  RETRYING
  CANCELLED

  @@map("job_status")
}

model Organization {
  id               String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  legalName        String             @map("legal_name") @db.VarChar(255)
  tradeName        String             @map("trade_name") @db.VarChar(255)
  documentNumber   String             @map("document_number") @db.VarChar(32)
  subscriptionPlan String             @map("subscription_plan") @db.VarChar(64)
  status           OrganizationStatus @default(ACTIVE)
  settings         Json               @default("{}") @db.JsonB
  createdAt        DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime           @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt        DateTime?          @map("deleted_at") @db.Timestamptz(6)

  users                 User[]
  roles                 Role[]
  persons               Person[]
  cases                 Case[]
  participants          CaseParticipant[]
  files                 StoredFile[]
  documents             Document[]
  documentTypes         DocumentType[]
  documentExtractions   DocumentExtraction[]
  extractedEntities     ExtractedEntity[]
  timelineEvents        TimelineEvent[]
  checklistTemplates    ChecklistTemplate[]
  checklistTemplateItems ChecklistTemplateItem[]
  caseChecklists        CaseChecklist[]
  caseChecklistItems    CaseChecklistItem[]
  tasks                 Task[]
  knowledgeChunks       KnowledgeChunk[]
  processingJobs        ProcessingJob[]
  auditLogs             AuditLog[]

  @@map("organizations")
}

model User {
  id             String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String     @map("organization_id") @db.Uuid
  name           String     @db.VarChar(255)
  email          String     @db.VarChar(320)
  passwordHash   String     @map("password_hash") @db.VarChar(255)
  status         UserStatus @default(INVITED)
  lastLoginAt    DateTime?  @map("last_login_at") @db.Timestamptz(6)
  createdAt      DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime?  @map("deleted_at") @db.Timestamptz(6)

  organization           Organization       @relation(fields: [organizationId], references: [id])
  userRoles              UserRole[]
  responsibleCases       Case[]             @relation("CaseResponsible")
  uploadedFiles          StoredFile[]       @relation("FileUploadedBy")
  classifiedDocuments    Document[]         @relation("DocumentClassifiedBy")
  confirmedTimelineEvents TimelineEvent[]   @relation("TimelineConfirmedBy")
  validatedChecklistItems CaseChecklistItem[] @relation("ChecklistValidatedBy")
  assignedTasks          Task[]             @relation("TaskAssignedTo")
  createdTasks           Task[]             @relation("TaskCreatedBy")
  auditLogs              AuditLog[]

  @@unique([organizationId, email])
  @@unique([organizationId, id])
  @@index([organizationId, status])
  @@map("users")
}

model Role {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String?   @map("organization_id") @db.Uuid
  name           String    @db.VarChar(120)
  code           String    @db.VarChar(80)
  description    String?   @db.Text
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization    Organization?   @relation(fields: [organizationId], references: [id])
  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@index([organizationId, code])
  @@map("roles")
}

model Permission {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code        String   @unique @db.VarChar(120)
  description String   @db.VarChar(255)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  rolePermissions RolePermission[]

  @@map("permissions")
}

model UserRole {
  userId    String   @map("user_id") @db.Uuid
  roleId    String   @map("role_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@index([roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId       String   @map("role_id") @db.Uuid
  permissionId String   @map("permission_id") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map("role_permissions")
}

model Person {
  id             String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String     @map("organization_id") @db.Uuid
  personType     PersonType @map("person_type")
  fullName       String     @map("full_name") @db.VarChar(255)
  tradeName      String?    @map("trade_name") @db.VarChar(255)
  cpf            String?    @db.VarChar(11)
  cnpj           String?    @db.VarChar(14)
  rg             String?    @db.VarChar(32)
  birthDate      DateTime?  @map("birth_date") @db.Date
  email          String?    @db.VarChar(320)
  phone          String?    @db.VarChar(32)
  occupation     String?    @db.VarChar(120)
  maritalStatus  String?    @map("marital_status") @db.VarChar(80)
  metadata       Json       @default("{}") @db.JsonB
  createdAt      DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime?  @map("deleted_at") @db.Timestamptz(6)

  organization Organization     @relation(fields: [organizationId], references: [id])
  participants CaseParticipant[]
  linkedExtractedEntities ExtractedEntity[] @relation("EntityLinkedPerson")

  @@unique([organizationId, id])
  @@index([organizationId, fullName])
  @@index([organizationId, cpf])
  @@index([organizationId, cnpj])
  @@map("persons")
}

model Case {
  id                   String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId       String               @map("organization_id") @db.Uuid
  internalCode         String               @map("internal_code") @db.VarChar(80)
  title                String               @db.VarChar(255)
  description          String?              @db.Text
  legalArea            String               @map("legal_area") @db.VarChar(120)
  caseType             String               @map("case_type") @db.VarChar(120)
  status               CaseStatus           @default(INTAKE)
  priority             Priority             @default(NORMAL)
  confidentialityLevel ConfidentialityLevel @default(STANDARD) @map("confidentiality_level")
  responsibleUserId    String?              @map("responsible_user_id") @db.Uuid
  openedAt             DateTime             @default(now()) @map("opened_at") @db.Timestamptz(6)
  closedAt             DateTime?            @map("closed_at") @db.Timestamptz(6)
  createdAt            DateTime             @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime             @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt            DateTime?            @map("deleted_at") @db.Timestamptz(6)

  organization    Organization      @relation(fields: [organizationId], references: [id])
  responsibleUser User?             @relation("CaseResponsible", fields: [organizationId, responsibleUserId], references: [organizationId, id])
  participants    CaseParticipant[]
  documents       Document[]
  timelineEvents  TimelineEvent[]
  caseChecklists  CaseChecklist[]
  tasks           Task[]
  knowledgeChunks KnowledgeChunk[]
  processingJobs  ProcessingJob[]

  @@unique([organizationId, internalCode])
  @@unique([organizationId, id])
  @@index([organizationId, status, updatedAt])
  @@index([organizationId, responsibleUserId])
  @@map("cases")
}

model CaseParticipant {
  id             String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String          @map("organization_id") @db.Uuid
  caseId         String          @map("case_id") @db.Uuid
  personId       String          @map("person_id") @db.Uuid
  role           String          @db.VarChar(80)
  side           ParticipantSide?
  isClient       Boolean         @default(false) @map("is_client")
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  case         Case         @relation(fields: [organizationId, caseId], references: [organizationId, id])
  person       Person       @relation(fields: [organizationId, personId], references: [organizationId, id])

  @@unique([caseId, personId, role])
  @@unique([organizationId, id])
  @@index([organizationId, caseId])
  @@index([organizationId, personId])
  @@map("case_participants")
}

model StoredFile {
  id                 String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId     String          @map("organization_id") @db.Uuid
  storageProvider    String          @map("storage_provider") @db.VarChar(40)
  storageBucket      String          @map("storage_bucket") @db.VarChar(120)
  storageKey         String          @map("storage_key") @db.VarChar(1024)
  originalFilename   String          @map("original_filename") @db.VarChar(255)
  mimeType           String          @map("mime_type") @db.VarChar(255)
  extension          String          @db.VarChar(32)
  sizeBytes          BigInt          @map("size_bytes")
  checksumSha256     String          @map("checksum_sha256") @db.Char(64)
  uploadedById       String          @map("uploaded_by") @db.Uuid
  uploadSource       String          @map("upload_source") @db.VarChar(40)
  virusScanStatus    VirusScanStatus @default(PENDING) @map("virus_scan_status")
  status             FileStatus      @default(QUARANTINED)
  duplicateOfFileId  String?         @map("duplicate_of_file_id") @db.Uuid
  createdAt          DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt          DateTime?       @map("deleted_at") @db.Timestamptz(6)

  organization    Organization  @relation(fields: [organizationId], references: [id])
  uploadedBy      User          @relation("FileUploadedBy", fields: [organizationId, uploadedById], references: [organizationId, id])
  duplicateOf     StoredFile?   @relation("FileDuplicates", fields: [organizationId, duplicateOfFileId], references: [organizationId, id])
  duplicates      StoredFile[]  @relation("FileDuplicates")
  documents       Document[]
  processingJobs  ProcessingJob[]

  @@unique([storageProvider, storageBucket, storageKey])
  @@unique([organizationId, id])
  @@index([organizationId, checksumSha256, sizeBytes])
  @@index([organizationId, status, createdAt])
  @@map("files")
}

model DocumentType {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String?   @map("organization_id") @db.Uuid
  code           String    @db.VarChar(100)
  name           String    @db.VarChar(160)
  category       String    @db.VarChar(100)
  description    String?   @db.Text
  requiredFields Json      @default("{}") @map("required_fields") @db.JsonB
  isSystem       Boolean   @default(false) @map("is_system")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization           Organization?           @relation(fields: [organizationId], references: [id])
  documents              Document[]
  checklistTemplateItems ChecklistTemplateItem[]

  @@index([organizationId, code])
  @@map("document_types")
}

model Document {
  id                   String                   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId       String                   @map("organization_id") @db.Uuid
  caseId               String?                  @map("case_id") @db.Uuid
  fileId               String                   @map("file_id") @db.Uuid
  documentTypeId       String?                  @map("document_type_id") @db.Uuid
  title                String                   @db.VarChar(255)
  description          String?                  @db.Text
  documentDate         DateTime?                @map("document_date") @db.Date
  issuer               String?                  @db.VarChar(255)
  recipient            String?                  @db.VarChar(255)
  classificationStatus ClassificationStatus     @default(PENDING) @map("classification_status")
  processingStatus     DocumentProcessingStatus @default(PENDING) @map("processing_status")
  confidenceScore      Decimal?                 @map("confidence_score") @db.Decimal(5, 4)
  isOriginal           Boolean                  @default(true) @map("is_original")
  isSigned             Boolean?                 @map("is_signed")
  isLegible            Boolean?                 @map("is_legible")
  isDuplicate          Boolean                  @default(false) @map("is_duplicate")
  parentDocumentId     String?                  @map("parent_document_id") @db.Uuid
  classifiedById       String?                  @map("classified_by") @db.Uuid
  classifiedAt         DateTime?                @map("classified_at") @db.Timestamptz(6)
  metadata             Json                     @default("{}") @db.JsonB
  createdAt            DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime                 @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt            DateTime?                @map("deleted_at") @db.Timestamptz(6)

  organization       Organization         @relation(fields: [organizationId], references: [id])
  case               Case?                @relation(fields: [organizationId, caseId], references: [organizationId, id])
  file               StoredFile           @relation(fields: [organizationId, fileId], references: [organizationId, id])
  documentType       DocumentType?         @relation(fields: [documentTypeId], references: [id])
  parentDocument     Document?             @relation("DocumentParent", fields: [organizationId, parentDocumentId], references: [organizationId, id])
  childDocuments     Document[]            @relation("DocumentParent")
  classifiedBy      User?                 @relation("DocumentClassifiedBy", fields: [organizationId, classifiedById], references: [organizationId, id])
  extractions       DocumentExtraction[]
  extractedEntities ExtractedEntity[]
  checklistItems    CaseChecklistItem[]
  knowledgeChunks   KnowledgeChunk[]
  processingJobs    ProcessingJob[]

  @@unique([organizationId, id])
  @@index([organizationId, caseId, processingStatus])
  @@index([organizationId, fileId])
  @@index([documentTypeId])
  @@map("documents")
}

model DocumentExtraction {
  id               String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String           @map("organization_id") @db.Uuid
  documentId       String           @map("document_id") @db.Uuid
  extractionType   ExtractionType   @map("extraction_type")
  provider         String           @db.VarChar(120)
  modelName        String           @map("model_name") @db.VarChar(160)
  modelVersion     String?          @map("model_version") @db.VarChar(120)
  executionId      String           @map("execution_id") @db.VarChar(160)
  status           ExtractionStatus
  rawText          String?          @map("raw_text") @db.Text
  structuredData   Json?            @map("structured_data") @db.JsonB
  confidenceScore  Decimal?         @map("confidence_score") @db.Decimal(5, 4)
  processingTimeMs Int?             @map("processing_time_ms")
  promptVersion    String?          @map("prompt_version") @db.VarChar(80)
  errorCode        String?          @map("error_code") @db.VarChar(100)
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)

  organization     Organization    @relation(fields: [organizationId], references: [id])
  document         Document        @relation(fields: [organizationId, documentId], references: [organizationId, id])
  extractedEntities ExtractedEntity[]
  timelineEvents   TimelineEvent[]

  @@unique([organizationId, id])
  @@unique([organizationId, documentId, id])
  @@unique([organizationId, provider, executionId])
  @@index([organizationId, documentId, extractionType, createdAt])
  @@map("document_extractions")
}

model ExtractedEntity {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String    @map("organization_id") @db.Uuid
  documentId       String    @map("document_id") @db.Uuid
  extractionId     String    @map("extraction_id") @db.Uuid
  entityType       String    @map("entity_type") @db.VarChar(80)
  normalizedValue  String    @map("normalized_value") @db.Text
  originalValue    String    @map("original_value") @db.Text
  pageNumber       Int?      @map("page_number")
  startOffset      Int?      @map("start_offset")
  endOffset        Int?      @map("end_offset")
  confidenceScore  Decimal?  @map("confidence_score") @db.Decimal(5, 4)
  linkedPersonId   String?   @map("linked_person_id") @db.Uuid
  metadata         Json      @default("{}") @db.JsonB
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization       @relation(fields: [organizationId], references: [id])
  document     Document           @relation(fields: [organizationId, documentId], references: [organizationId, id])
  extraction   DocumentExtraction @relation(fields: [organizationId, documentId, extractionId], references: [organizationId, documentId, id])
  linkedPerson Person?            @relation("EntityLinkedPerson", fields: [organizationId, linkedPersonId], references: [organizationId, id])

  @@unique([organizationId, id])
  @@index([organizationId, documentId, entityType])
  @@index([organizationId, linkedPersonId])
  @@map("extracted_entities")
}

model TimelineEvent {
  id                    String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId        String        @map("organization_id") @db.Uuid
  caseId                String        @map("case_id") @db.Uuid
  eventType             String        @map("event_type") @db.VarChar(100)
  title                 String        @db.VarChar(255)
  description           String        @db.Text
  occurredAt            DateTime?     @map("occurred_at") @db.Timestamptz(6)
  datePrecision         DatePrecision @map("date_precision")
  importance            Importance    @default(NORMAL)
  sourceType            String        @map("source_type") @db.VarChar(80)
  sourceId              String?       @map("source_id") @db.Uuid
  sourceLocator         Json?         @map("source_locator") @db.JsonB
  extractionId          String?       @map("extraction_id") @db.Uuid
  confidenceScore       Decimal?      @map("confidence_score") @db.Decimal(5, 4)
  createdByActorType    ActorType     @default(USER) @map("created_by_actor_type")
  confirmedByUser       Boolean       @default(false) @map("confirmed_by_user")
  confirmedById         String?       @map("confirmed_by") @db.Uuid
  confirmedAt           DateTime?     @map("confirmed_at") @db.Timestamptz(6)
  createdAt             DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt             DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization        @relation(fields: [organizationId], references: [id])
  case         Case                @relation(fields: [organizationId, caseId], references: [organizationId, id])
  extraction   DocumentExtraction? @relation(fields: [organizationId, extractionId], references: [organizationId, id])
  confirmedBy  User?               @relation("TimelineConfirmedBy", fields: [organizationId, confirmedById], references: [organizationId, id])

  @@unique([organizationId, id])
  @@index([organizationId, caseId, occurredAt])
  @@index([organizationId, caseId, confirmedByUser])
  @@map("timeline_events")
}

model ChecklistTemplate {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String?   @map("organization_id") @db.Uuid
  name           String    @db.VarChar(200)
  legalArea      String    @map("legal_area") @db.VarChar(120)
  caseType       String    @map("case_type") @db.VarChar(120)
  version        Int
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization   Organization?          @relation(fields: [organizationId], references: [id])
  items          ChecklistTemplateItem[]
  caseChecklists CaseChecklist[]

  @@index([organizationId, legalArea, caseType, isActive])
  @@map("checklist_templates")
}

model ChecklistTemplateItem {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String?  @map("organization_id") @db.Uuid
  templateId     String   @map("template_id") @db.Uuid
  documentTypeId String?  @map("document_type_id") @db.Uuid
  title          String   @db.VarChar(200)
  description    String?  @db.Text
  isRequired     Boolean  @default(true) @map("is_required")
  conditionRule  Json?    @map("condition_rule") @db.JsonB
  sortOrder      Int      @map("sort_order")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization   Organization?     @relation(fields: [organizationId], references: [id])
  template       ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  documentType   DocumentType?     @relation(fields: [documentTypeId], references: [id])
  caseItems      CaseChecklistItem[]

  @@unique([templateId, sortOrder])
  @@index([organizationId, templateId])
  @@map("checklist_template_items")
}

model CaseChecklist {
  id              String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId  String              @map("organization_id") @db.Uuid
  caseId          String              @map("case_id") @db.Uuid
  templateId      String              @map("template_id") @db.Uuid
  templateVersion Int                 @map("template_version")
  status          CaseChecklistStatus @default(IN_PROGRESS)
  createdAt       DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization      @relation(fields: [organizationId], references: [id])
  case         Case              @relation(fields: [organizationId, caseId], references: [organizationId, id])
  template     ChecklistTemplate @relation(fields: [templateId], references: [id])
  items        CaseChecklistItem[]

  @@unique([organizationId, id])
  @@unique([caseId, templateId, templateVersion])
  @@index([organizationId, caseId, status])
  @@map("case_checklists")
}

model CaseChecklistItem {
  id                  String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId      String          @map("organization_id") @db.Uuid
  caseChecklistId     String          @map("case_checklist_id") @db.Uuid
  templateItemId      String          @map("template_item_id") @db.Uuid
  titleSnapshot       String          @map("title_snapshot") @db.VarChar(200)
  descriptionSnapshot String?         @map("description_snapshot") @db.Text
  isRequiredSnapshot  Boolean         @map("is_required_snapshot")
  status              ChecklistStatus @default(MISSING)
  documentId          String?         @map("document_id") @db.Uuid
  validatedById       String?         @map("validated_by") @db.Uuid
  validatedAt         DateTime?       @map("validated_at") @db.Timestamptz(6)
  notes               String?         @db.Text
  createdAt           DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization  Organization          @relation(fields: [organizationId], references: [id])
  caseChecklist CaseChecklist         @relation(fields: [organizationId, caseChecklistId], references: [organizationId, id], onDelete: Cascade)
  templateItem  ChecklistTemplateItem @relation(fields: [templateItemId], references: [id])
  document      Document?             @relation(fields: [organizationId, documentId], references: [organizationId, id])
  validatedBy   User?                 @relation("ChecklistValidatedBy", fields: [organizationId, validatedById], references: [organizationId, id])

  @@unique([organizationId, id])
  @@unique([caseChecklistId, templateItemId])
  @@index([organizationId, caseChecklistId, status])
  @@map("case_checklist_items")
}

model Task {
  id             String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String         @map("organization_id") @db.Uuid
  caseId         String?        @map("case_id") @db.Uuid
  title          String         @db.VarChar(255)
  description    String?        @db.Text
  taskType       String         @map("task_type") @db.VarChar(80)
  status         TaskStatus     @default(OPEN)
  priority       Priority       @default(NORMAL)
  assignedToId   String?        @map("assigned_to") @db.Uuid
  createdById    String?        @map("created_by") @db.Uuid
  dueAt          DateTime?      @map("due_at") @db.Timestamptz(6)
  completedAt    DateTime?      @map("completed_at") @db.Timestamptz(6)
  sourceType     TaskSourceType @default(USER) @map("source_type")
  sourceId       String?        @map("source_id") @db.Uuid
  createdAt      DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime?      @map("deleted_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  case         Case?        @relation(fields: [organizationId, caseId], references: [organizationId, id])
  assignedTo   User?        @relation("TaskAssignedTo", fields: [organizationId, assignedToId], references: [organizationId, id])
  createdBy    User?        @relation("TaskCreatedBy", fields: [organizationId, createdById], references: [organizationId, id])

  @@unique([organizationId, id])
  @@index([organizationId, caseId, status, dueAt])
  @@index([organizationId, assignedToId, status])
  @@map("tasks")
}

model KnowledgeChunk {
  id                String                 @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId    String                 @map("organization_id") @db.Uuid
  caseId            String?                @map("case_id") @db.Uuid
  documentId        String?                @map("document_id") @db.Uuid
  sourceType        String                 @map("source_type") @db.VarChar(80)
  sourceId          String                 @map("source_id") @db.Uuid
  chunkIndex        Int                    @map("chunk_index")
  content           String                 @db.Text
  contentHash       String                 @map("content_hash") @db.Char(64)
  embedding         Unsupported("vector")?
  embeddingProvider String?                @map("embedding_provider") @db.VarChar(120)
  embeddingModel    String?                @map("embedding_model") @db.VarChar(160)
  embeddingVersion  String?                @map("embedding_version") @db.VarChar(120)
  embeddingDimensions Int?                 @map("embedding_dimensions")
  metadata          Json                   @default("{}") @db.JsonB
  createdAt         DateTime               @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  case         Case?        @relation(fields: [organizationId, caseId], references: [organizationId, id])
  document     Document?    @relation(fields: [organizationId, documentId], references: [organizationId, id])

  @@unique([organizationId, sourceType, sourceId, chunkIndex, contentHash])
  @@index([organizationId, caseId])
  @@index([organizationId, documentId])
  @@map("knowledge_chunks")
}

model ProcessingJob {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  caseId         String?   @map("case_id") @db.Uuid
  fileId         String?   @map("file_id") @db.Uuid
  documentId     String?   @map("document_id") @db.Uuid
  jobType        JobType   @map("job_type")
  status         JobStatus @default(QUEUED)
  priority       Int       @default(0)
  attempts       Int       @default(0)
  version        Int       @default(0)
  provider       String?   @db.VarChar(120)
  modelName      String?   @map("model_name") @db.VarChar(160)
  inputMetadata  Json?     @map("input_metadata") @db.JsonB
  outputMetadata Json?     @map("output_metadata") @db.JsonB
  errorCode      String?   @map("error_code") @db.VarChar(100)
  errorMessage   String?   @map("error_message") @db.Text
  startedAt      DateTime? @map("started_at") @db.Timestamptz(6)
  finishedAt     DateTime? @map("finished_at") @db.Timestamptz(6)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  case         Case?        @relation(fields: [organizationId, caseId], references: [organizationId, id])
  file         StoredFile?  @relation(fields: [organizationId, fileId], references: [organizationId, id])
  document     Document?    @relation(fields: [organizationId, documentId], references: [organizationId, id])
  auditLogs    AuditLog[]

  @@unique([organizationId, id])
  @@index([organizationId, status, createdAt])
  @@index([status, createdAt])
  @@index([organizationId, fileId])
  @@index([organizationId, documentId])
  @@map("processing_jobs")
}

model AuditLog {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId  String    @map("organization_id") @db.Uuid
  userId          String?   @map("user_id") @db.Uuid
  actorType        ActorType @map("actor_type")
  actorId          String?   @map("actor_id") @db.VarChar(160)
  action           String    @db.VarChar(160)
  entityType       String    @map("entity_type") @db.VarChar(120)
  entityId         String?   @map("entity_id") @db.Uuid
  oldData          Json?     @map("old_data") @db.JsonB
  newData          Json?     @map("new_data") @db.JsonB
  ipAddress        String?   @map("ip_address") @db.Inet
  userAgent        String?   @map("user_agent") @db.Text
  requestId        String?   @map("request_id") @db.VarChar(160)
  correlationId    String?   @map("correlation_id") @db.VarChar(160)
  processingJobId  String?   @map("processing_job_id") @db.Uuid
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  organization  Organization   @relation(fields: [organizationId], references: [id])
  user          User?          @relation(fields: [organizationId, userId], references: [organizationId, id])
  processingJob ProcessingJob? @relation(fields: [organizationId, processingJobId], references: [organizationId, id])

  @@index([organizationId, createdAt])
  @@index([organizationId, entityType, entityId, createdAt])
  @@index([organizationId, correlationId])
  @@map("audit_logs")
}
```

## Required SQL migration additions

Prisma cannot fully express several required PostgreSQL features. The generated initial migration must be reviewed and amended with equivalent SQL:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE UNIQUE INDEX roles_global_code_key
  ON roles (code)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX roles_organization_code_key
  ON roles (organization_id, code)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX document_types_global_code_key
  ON document_types (code)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX document_types_organization_code_key
  ON document_types (organization_id, code)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX checklist_templates_global_version_key
  ON checklist_templates (legal_area, case_type, version)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX checklist_templates_organization_version_key
  ON checklist_templates (organization_id, legal_area, case_type, version)
  WHERE organization_id IS NOT NULL;

ALTER TABLE files
  ADD CONSTRAINT files_size_bytes_nonnegative CHECK (size_bytes >= 0),
  ADD CONSTRAINT files_not_self_duplicate CHECK (duplicate_of_file_id IS NULL OR duplicate_of_file_id <> id);

ALTER TABLE document_extractions
  ADD CONSTRAINT document_extractions_duration_nonnegative
  CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0);

ALTER TABLE timeline_events
  ADD CONSTRAINT timeline_confirmation_consistent CHECK (
    (confirmed_by_user = false AND confirmed_by IS NULL AND confirmed_at IS NULL)
    OR
    (confirmed_by_user = true AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
  );

ALTER TABLE processing_jobs
  ADD CONSTRAINT processing_jobs_attempts_nonnegative CHECK (attempts >= 0),
  ADD CONSTRAINT processing_jobs_version_nonnegative CHECK (version >= 0);
```

The full-text generated column/expression index should be added only after the Portuguese text-search configuration and normalization behavior are covered by tests. The unbounded `vector` column receives no HNSW/IVFFlat index in the initial migration.

## Validation checklist for the database delivery

Delivery 3 validation outcome:

1. Node, pnpm, Prisma CLI, Prisma Client, PostgreSQL adapter, and PostgreSQL versions are pinned and compatible.
2. `prisma format`, `prisma validate`, generation, typecheck, and the initial migration pass against local PostgreSQL 18 with pgvector.
3. Composite tenant relations are represented in Prisma and enforced by composite foreign keys.
4. Generated enums, foreign keys, delete actions, indexes, defaults, extensions, partial indexes, and checks were reviewed.
5. Negative integration tests cover representative cross-tenant relations, partial uniqueness, and check constraints.
6. The seed is idempotent, uses reserved fictional data, and persists only an Argon2id password hash.
7. Global-or-tenant visibility remains an application-level responsibility; Delivery 4 enforces and tests it for authenticated role permissions, while later catalog modules retain the same obligation.
8. Full-text and approximate vector indexes remain deferred until their configuration and synthetic benchmarks exist.

## Authentication support table

Delivery 3 added the narrowly scoped `refresh_sessions` support model described here. It contains a composite organization/user relation, token-family ID, a unique SHA-256-format token hash, expiry, rotation/revocation metadata, optional user-agent/IP metadata, and timestamps. Plain refresh tokens are not persisted.
