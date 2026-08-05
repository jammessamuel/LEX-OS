-- Required PostgreSQL extensions. These statements must precede tables that use
-- gen_random_uuid() and the vector data type.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "person_type" AS ENUM ('INDIVIDUAL', 'COMPANY', 'GOVERNMENT_ENTITY');

-- CreateEnum
CREATE TYPE "case_status" AS ENUM ('INTAKE', 'DOCUMENT_COLLECTION', 'UNDER_ANALYSIS', 'READY_TO_FILE', 'FILED', 'ACTIVE', 'SUSPENDED', 'SETTLED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "confidentiality_level" AS ENUM ('STANDARD', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "participant_side" AS ENUM ('polo_ativo', 'polo_passivo', 'terceiro', 'neutro');

-- CreateEnum
CREATE TYPE "virus_scan_status" AS ENUM ('PENDING', 'PROCESSING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "file_status" AS ENUM ('QUARANTINED', 'VALIDATING', 'AVAILABLE', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "classification_status" AS ENUM ('PENDING', 'PROCESSING', 'CLASSIFIED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "document_processing_status" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "extraction_type" AS ENUM ('OCR', 'TRANSCRIPTION', 'CLASSIFICATION', 'SUMMARY', 'ENTITY_EXTRACTION', 'IMAGE_ANALYSIS', 'TIMELINE_ANALYSIS', 'CHECKLIST_ANALYSIS');

-- CreateEnum
CREATE TYPE "extraction_status" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "date_precision" AS ENUM ('EXACT', 'DAY', 'MONTH', 'YEAR', 'APPROXIMATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "importance" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('USER', 'SYSTEM', 'AI', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "checklist_status" AS ENUM ('MISSING', 'RECEIVED', 'INVALID', 'EXPIRED', 'ILLEGIBLE', 'AWAITING_VALIDATION', 'VALIDATED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "case_checklist_status" AS ENUM ('IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "task_source_type" AS ENUM ('USER', 'AI_CHECKLIST', 'AI_DOCUMENT_ANALYSIS', 'COURT_MOVEMENT', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('OCR', 'TRANSCRIPTION', 'DOCUMENT_CLASSIFICATION', 'ENTITY_EXTRACTION', 'SUMMARY', 'EMBEDDING', 'TIMELINE_GENERATION', 'CHECKLIST_ANALYSIS', 'DUPLICATE_DETECTION', 'FILE_VALIDATION', 'VIRUS_SCAN');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legal_name" VARCHAR(255) NOT NULL,
    "trade_name" VARCHAR(255) NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "subscription_plan" VARCHAR(64) NOT NULL,
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_family_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "rotated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(120),
    "user_agent" TEXT,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "person_type" "person_type" NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "trade_name" VARCHAR(255),
    "cpf" VARCHAR(11),
    "cnpj" VARCHAR(14),
    "rg" VARCHAR(32),
    "birth_date" DATE,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "occupation" VARCHAR(120),
    "marital_status" VARCHAR(80),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "internal_code" VARCHAR(80) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "legal_area" VARCHAR(120) NOT NULL,
    "case_type" VARCHAR(120) NOT NULL,
    "status" "case_status" NOT NULL DEFAULT 'INTAKE',
    "priority" "priority" NOT NULL DEFAULT 'NORMAL',
    "confidentiality_level" "confidentiality_level" NOT NULL DEFAULT 'STANDARD',
    "responsible_user_id" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role" VARCHAR(80) NOT NULL,
    "side" "participant_side",
    "is_client" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "storage_provider" VARCHAR(40) NOT NULL,
    "storage_bucket" VARCHAR(120) NOT NULL,
    "storage_key" VARCHAR(1024) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "extension" VARCHAR(32) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "upload_source" VARCHAR(40) NOT NULL,
    "virus_scan_status" "virus_scan_status" NOT NULL DEFAULT 'PENDING',
    "status" "file_status" NOT NULL DEFAULT 'QUARANTINED',
    "duplicate_of_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "required_fields" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID,
    "file_id" UUID NOT NULL,
    "document_type_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "document_date" DATE,
    "issuer" VARCHAR(255),
    "recipient" VARCHAR(255),
    "classification_status" "classification_status" NOT NULL DEFAULT 'PENDING',
    "processing_status" "document_processing_status" NOT NULL DEFAULT 'PENDING',
    "confidence_score" DECIMAL(5,4),
    "is_original" BOOLEAN NOT NULL DEFAULT true,
    "is_signed" BOOLEAN,
    "is_legible" BOOLEAN,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "parent_document_id" UUID,
    "classified_by" UUID,
    "classified_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "extraction_type" "extraction_type" NOT NULL,
    "provider" VARCHAR(120) NOT NULL,
    "model_name" VARCHAR(160) NOT NULL,
    "model_version" VARCHAR(120),
    "execution_id" VARCHAR(160) NOT NULL,
    "status" "extraction_status" NOT NULL,
    "raw_text" TEXT,
    "structured_data" JSONB,
    "confidence_score" DECIMAL(5,4),
    "processing_time_ms" INTEGER,
    "prompt_version" VARCHAR(80),
    "error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "extraction_id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "original_value" TEXT NOT NULL,
    "page_number" INTEGER,
    "start_offset" INTEGER,
    "end_offset" INTEGER,
    "confidence_score" DECIMAL(5,4),
    "linked_person_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6),
    "date_precision" "date_precision" NOT NULL,
    "importance" "importance" NOT NULL DEFAULT 'NORMAL',
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" UUID,
    "source_locator" JSONB,
    "extraction_id" UUID,
    "confidence_score" DECIMAL(5,4),
    "created_by_actor_type" "actor_type" NOT NULL DEFAULT 'USER',
    "confirmed_by_user" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "legal_area" VARCHAR(120) NOT NULL,
    "case_type" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "template_id" UUID NOT NULL,
    "document_type_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "condition_rule" JSONB,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_checklists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "status" "case_checklist_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_checklist_id" UUID NOT NULL,
    "template_item_id" UUID NOT NULL,
    "title_snapshot" VARCHAR(200) NOT NULL,
    "description_snapshot" TEXT,
    "is_required_snapshot" BOOLEAN NOT NULL,
    "status" "checklist_status" NOT NULL DEFAULT 'MISSING',
    "document_id" UUID,
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "task_type" VARCHAR(80) NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'OPEN',
    "priority" "priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_to" UUID,
    "created_by" UUID,
    "due_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "source_type" "task_source_type" NOT NULL DEFAULT 'USER',
    "source_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID,
    "document_id" UUID,
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "embedding" vector,
    "embedding_provider" VARCHAR(120),
    "embedding_model" VARCHAR(160),
    "embedding_version" VARCHAR(120),
    "embedding_dimensions" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID,
    "file_id" UUID,
    "document_id" UUID,
    "job_type" "job_type" NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "provider" VARCHAR(120),
    "model_name" VARCHAR(160),
    "input_metadata" JSONB,
    "output_metadata" JSONB,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "actor_type" "actor_type" NOT NULL,
    "actor_id" VARCHAR(160),
    "action" VARCHAR(160) NOT NULL,
    "entity_type" VARCHAR(120) NOT NULL,
    "entity_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "request_id" VARCHAR(160),
    "correlation_id" VARCHAR(160),
    "processing_job_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_id_key" ON "users"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_organization_id_user_id_revoked_at_idx" ON "refresh_sessions"("organization_id", "user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_token_family_id_idx" ON "refresh_sessions"("token_family_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_organization_id_id_key" ON "refresh_sessions"("organization_id", "id");

-- CreateIndex
CREATE INDEX "roles_organization_id_code_idx" ON "roles"("organization_id", "code");

-- Prisma does not model partial unique indexes. Together these indexes enforce
-- one global role code and one role code per organization.
CREATE UNIQUE INDEX "roles_global_code_key" ON "roles"("code")
WHERE "organization_id" IS NULL;

CREATE UNIQUE INDEX "roles_organization_code_key" ON "roles"("organization_id", "code")
WHERE "organization_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "persons_organization_id_full_name_idx" ON "persons"("organization_id", "full_name");

-- CreateIndex
CREATE INDEX "persons_organization_id_cpf_idx" ON "persons"("organization_id", "cpf");

-- CreateIndex
CREATE INDEX "persons_organization_id_cnpj_idx" ON "persons"("organization_id", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "persons_organization_id_id_key" ON "persons"("organization_id", "id");

-- CreateIndex
CREATE INDEX "cases_organization_id_status_updated_at_idx" ON "cases"("organization_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "cases_organization_id_responsible_user_id_idx" ON "cases"("organization_id", "responsible_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cases_organization_id_internal_code_key" ON "cases"("organization_id", "internal_code");

-- CreateIndex
CREATE UNIQUE INDEX "cases_organization_id_id_key" ON "cases"("organization_id", "id");

-- CreateIndex
CREATE INDEX "case_participants_organization_id_case_id_idx" ON "case_participants"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "case_participants_organization_id_person_id_idx" ON "case_participants"("organization_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_participants_case_id_person_id_role_key" ON "case_participants"("case_id", "person_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "case_participants_organization_id_id_key" ON "case_participants"("organization_id", "id");

-- CreateIndex
CREATE INDEX "files_organization_id_uploaded_by_idx" ON "files"("organization_id", "uploaded_by");

-- CreateIndex
CREATE INDEX "files_organization_id_checksum_sha256_size_bytes_idx" ON "files"("organization_id", "checksum_sha256", "size_bytes");

-- CreateIndex
CREATE INDEX "files_organization_id_status_created_at_idx" ON "files"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "files_organization_id_duplicate_of_file_id_idx" ON "files"("organization_id", "duplicate_of_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_provider_storage_bucket_storage_key_key" ON "files"("storage_provider", "storage_bucket", "storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "files_organization_id_id_key" ON "files"("organization_id", "id");

-- CreateIndex
CREATE INDEX "document_types_organization_id_code_idx" ON "document_types"("organization_id", "code");

CREATE UNIQUE INDEX "document_types_global_code_key" ON "document_types"("code")
WHERE "organization_id" IS NULL;

CREATE UNIQUE INDEX "document_types_organization_code_key" ON "document_types"("organization_id", "code")
WHERE "organization_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "documents_organization_id_case_id_processing_status_idx" ON "documents"("organization_id", "case_id", "processing_status");

-- CreateIndex
CREATE INDEX "documents_organization_id_file_id_idx" ON "documents"("organization_id", "file_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_parent_document_id_idx" ON "documents"("organization_id", "parent_document_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_classified_by_idx" ON "documents"("organization_id", "classified_by");

-- CreateIndex
CREATE INDEX "documents_document_type_id_idx" ON "documents"("document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_organization_id_id_key" ON "documents"("organization_id", "id");

-- CreateIndex
CREATE INDEX "document_extractions_organization_id_document_id_extraction_idx" ON "document_extractions"("organization_id", "document_id", "extraction_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_extractions_organization_id_id_key" ON "document_extractions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_extractions_organization_id_document_id_id_key" ON "document_extractions"("organization_id", "document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_extractions_organization_id_provider_execution_id_key" ON "document_extractions"("organization_id", "provider", "execution_id");

-- CreateIndex
CREATE INDEX "extracted_entities_organization_id_document_id_extract_idx" ON "extracted_entities"("organization_id", "document_id", "extraction_id");

-- CreateIndex
CREATE INDEX "extracted_entities_organization_id_document_id_entity_type_idx" ON "extracted_entities"("organization_id", "document_id", "entity_type");

-- CreateIndex
CREATE INDEX "extracted_entities_organization_id_linked_person_id_idx" ON "extracted_entities"("organization_id", "linked_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_entities_organization_id_id_key" ON "extracted_entities"("organization_id", "id");

-- CreateIndex
CREATE INDEX "timeline_events_organization_id_case_id_occurred_at_idx" ON "timeline_events"("organization_id", "case_id", "occurred_at");

-- CreateIndex
CREATE INDEX "timeline_events_organization_id_case_id_confirmed_by_user_idx" ON "timeline_events"("organization_id", "case_id", "confirmed_by_user");

-- CreateIndex
CREATE INDEX "timeline_events_organization_id_extraction_id_idx" ON "timeline_events"("organization_id", "extraction_id");

-- CreateIndex
CREATE INDEX "timeline_events_organization_id_confirmed_by_idx" ON "timeline_events"("organization_id", "confirmed_by");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_events_organization_id_id_key" ON "timeline_events"("organization_id", "id");

-- CreateIndex
CREATE INDEX "checklist_templates_organization_id_legal_area_case_type_is_idx" ON "checklist_templates"("organization_id", "legal_area", "case_type", "is_active");

CREATE UNIQUE INDEX "checklist_templates_global_version_key"
ON "checklist_templates"("legal_area", "case_type", "version")
WHERE "organization_id" IS NULL;

CREATE UNIQUE INDEX "checklist_templates_organization_version_key"
ON "checklist_templates"("organization_id", "legal_area", "case_type", "version")
WHERE "organization_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "checklist_template_items_organization_id_template_id_idx" ON "checklist_template_items"("organization_id", "template_id");

-- CreateIndex
CREATE INDEX "checklist_template_items_document_type_id_idx" ON "checklist_template_items"("document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_template_items_template_id_sort_order_key" ON "checklist_template_items"("template_id", "sort_order");

-- CreateIndex
CREATE INDEX "case_checklists_organization_id_case_id_status_idx" ON "case_checklists"("organization_id", "case_id", "status");

-- CreateIndex
CREATE INDEX "case_checklists_template_id_idx" ON "case_checklists"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_checklists_organization_id_id_key" ON "case_checklists"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "case_checklists_case_id_template_id_template_version_key" ON "case_checklists"("case_id", "template_id", "template_version");

-- CreateIndex
CREATE INDEX "case_checklist_items_organization_id_case_checklist_id_stat_idx" ON "case_checklist_items"("organization_id", "case_checklist_id", "status");

-- CreateIndex
CREATE INDEX "case_checklist_items_organization_id_document_id_idx" ON "case_checklist_items"("organization_id", "document_id");

-- CreateIndex
CREATE INDEX "case_checklist_items_organization_id_validated_by_idx" ON "case_checklist_items"("organization_id", "validated_by");

-- CreateIndex
CREATE INDEX "case_checklist_items_template_item_id_idx" ON "case_checklist_items"("template_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_checklist_items_organization_id_id_key" ON "case_checklist_items"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "case_checklist_items_case_checklist_id_template_item_id_key" ON "case_checklist_items"("case_checklist_id", "template_item_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_case_id_status_due_at_idx" ON "tasks"("organization_id", "case_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_organization_id_assigned_to_status_idx" ON "tasks"("organization_id", "assigned_to", "status");

-- CreateIndex
CREATE INDEX "tasks_organization_id_created_by_idx" ON "tasks"("organization_id", "created_by");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_id_key" ON "tasks"("organization_id", "id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_organization_id_case_id_idx" ON "knowledge_chunks"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_organization_id_document_id_idx" ON "knowledge_chunks"("organization_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_organization_id_source_type_source_id_chun_key" ON "knowledge_chunks"("organization_id", "source_type", "source_id", "chunk_index", "content_hash");

-- CreateIndex
CREATE INDEX "processing_jobs_organization_id_status_created_at_idx" ON "processing_jobs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "processing_jobs_status_created_at_idx" ON "processing_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "processing_jobs_organization_id_case_id_idx" ON "processing_jobs"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "processing_jobs_organization_id_file_id_idx" ON "processing_jobs"("organization_id", "file_id");

-- CreateIndex
CREATE INDEX "processing_jobs_organization_id_document_id_idx" ON "processing_jobs"("organization_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_organization_id_id_key" ON "processing_jobs"("organization_id", "id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_type_entity_id_created_at_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_correlation_id_idx" ON "audit_logs"("organization_id", "correlation_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_user_id_idx" ON "audit_logs"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_processing_job_id_idx" ON "audit_logs"("organization_id", "processing_job_id");

-- Database-level invariants that cannot be expressed by the Prisma schema.
ALTER TABLE "refresh_sessions"
    ADD CONSTRAINT "refresh_sessions_token_hash_format" CHECK (btrim("token_hash") ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "refresh_sessions_expiry_after_creation" CHECK ("expires_at" > "created_at"),
    ADD CONSTRAINT "refresh_sessions_rotation_after_creation" CHECK ("rotated_at" IS NULL OR "rotated_at" >= "created_at"),
    ADD CONSTRAINT "refresh_sessions_revocation_after_creation" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at");

ALTER TABLE "files"
    ADD CONSTRAINT "files_size_bytes_nonnegative" CHECK ("size_bytes" >= 0),
    ADD CONSTRAINT "files_not_self_duplicate" CHECK ("duplicate_of_file_id" IS NULL OR "duplicate_of_file_id" <> "id");

ALTER TABLE "document_extractions"
    ADD CONSTRAINT "document_extractions_duration_nonnegative"
    CHECK ("processing_time_ms" IS NULL OR "processing_time_ms" >= 0);

ALTER TABLE "timeline_events"
    ADD CONSTRAINT "timeline_confirmation_consistent" CHECK (
        ("confirmed_by_user" = false AND "confirmed_by" IS NULL AND "confirmed_at" IS NULL)
        OR
        ("confirmed_by_user" = true AND "confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    );

ALTER TABLE "processing_jobs"
    ADD CONSTRAINT "processing_jobs_attempts_nonnegative" CHECK ("attempts" >= 0),
    ADD CONSTRAINT "processing_jobs_version_nonnegative" CHECK ("version" >= 0);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_responsible_user_id_fkey" FOREIGN KEY ("organization_id", "responsible_user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_participants" ADD CONSTRAINT "case_participants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_participants" ADD CONSTRAINT "case_participants_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_participants" ADD CONSTRAINT "case_participants_organization_id_person_id_fkey" FOREIGN KEY ("organization_id", "person_id") REFERENCES "persons"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_uploaded_by_fkey" FOREIGN KEY ("organization_id", "uploaded_by") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_duplicate_of_file_id_fkey" FOREIGN KEY ("organization_id", "duplicate_of_file_id") REFERENCES "files"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_file_id_fkey" FOREIGN KEY ("organization_id", "file_id") REFERENCES "files"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_parent_document_id_fkey" FOREIGN KEY ("organization_id", "parent_document_id") REFERENCES "documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_classified_by_fkey" FOREIGN KEY ("organization_id", "classified_by") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_organization_id_document_id_extraction__fkey" FOREIGN KEY ("organization_id", "document_id", "extraction_id") REFERENCES "document_extractions"("organization_id", "document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_organization_id_linked_person_id_fkey" FOREIGN KEY ("organization_id", "linked_person_id") REFERENCES "persons"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_organization_id_extraction_id_fkey" FOREIGN KEY ("organization_id", "extraction_id") REFERENCES "document_extractions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_organization_id_confirmed_by_fkey" FOREIGN KEY ("organization_id", "confirmed_by") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklists" ADD CONSTRAINT "case_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklists" ADD CONSTRAINT "case_checklists_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklists" ADD CONSTRAINT "case_checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklist_items" ADD CONSTRAINT "case_checklist_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklist_items" ADD CONSTRAINT "case_checklist_items_organization_id_case_checklist_id_fkey" FOREIGN KEY ("organization_id", "case_checklist_id") REFERENCES "case_checklists"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklist_items" ADD CONSTRAINT "case_checklist_items_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "checklist_template_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklist_items" ADD CONSTRAINT "case_checklist_items_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_checklist_items" ADD CONSTRAINT "case_checklist_items_organization_id_validated_by_fkey" FOREIGN KEY ("organization_id", "validated_by") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_assigned_to_fkey" FOREIGN KEY ("organization_id", "assigned_to") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_created_by_fkey" FOREIGN KEY ("organization_id", "created_by") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_organization_id_case_id_fkey" FOREIGN KEY ("organization_id", "case_id") REFERENCES "cases"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_organization_id_file_id_fkey" FOREIGN KEY ("organization_id", "file_id") REFERENCES "files"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_processing_job_id_fkey" FOREIGN KEY ("organization_id", "processing_job_id") REFERENCES "processing_jobs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
