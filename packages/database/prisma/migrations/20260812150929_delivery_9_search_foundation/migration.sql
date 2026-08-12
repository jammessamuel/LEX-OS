/*
  Warnings:

  - You are about to drop the column `search_vector` on the `knowledge_chunks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "case_checklists_tenant_case_created_at_id_idx";

-- DropIndex
DROP INDEX "case_participants_organization_case_created_id_idx";

-- DropIndex
DROP INDEX "document_extractions_tenant_document_created_at_id_idx";

-- DropIndex
DROP INDEX "knowledge_chunks_search_vector_gin_idx";

-- DropIndex
DROP INDEX "knowledge_chunks_tenant_source_lookup_idx";

-- DropIndex
DROP INDEX "processing_jobs_tenant_created_at_id_idx";

-- DropIndex
DROP INDEX "timeline_events_tenant_case_created_at_id_idx";

-- AlterTable
ALTER TABLE "knowledge_chunks" DROP COLUMN "search_vector";

-- RenameForeignKey
ALTER TABLE "case_checklist_items" RENAME CONSTRAINT "case_checklist_items_organization_id_case_id_case_checklist_fke" TO "case_checklist_items_organization_id_case_id_case_checklis_fkey";

-- RenameIndex
ALTER INDEX "extracted_entities_organization_id_document_id_extract_idx" RENAME TO "extracted_entities_organization_id_document_id_extraction_i_idx";
