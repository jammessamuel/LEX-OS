import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationsDirectory = fileURLToPath(new URL('../prisma/migrations', import.meta.url));
const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const migrationDirectories = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrationDirectories.length === 0) {
  throw new Error('At least one reviewed SQL migration is required.');
}

const initialMigration = migrationDirectories.find((name) => name.endsWith('_initial_schema'));

if (initialMigration === undefined) {
  throw new Error('The reviewed initial_schema migration is missing.');
}

const migrationSql = new Map(
  await Promise.all(
    migrationDirectories.map(async (name) => [
      name,
      await readFile(`${migrationsDirectory}/${name}/migration.sql`, 'utf8'),
    ]),
  ),
);
const sql = migrationSql.get(initialMigration);

if (sql === undefined) {
  throw new Error('The reviewed initial_schema migration could not be read.');
}

const requiredFragments = [
  'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
  'CREATE EXTENSION IF NOT EXISTS vector;',
  'CREATE UNIQUE INDEX "roles_global_code_key"',
  'CREATE UNIQUE INDEX "roles_organization_code_key"',
  'CREATE UNIQUE INDEX "document_types_global_code_key"',
  'CREATE UNIQUE INDEX "document_types_organization_code_key"',
  'CREATE UNIQUE INDEX "checklist_templates_global_version_key"',
  'CREATE UNIQUE INDEX "checklist_templates_organization_version_key"',
  'CONSTRAINT "files_size_bytes_nonnegative"',
  'CONSTRAINT "timeline_confirmation_consistent"',
  'CONSTRAINT "processing_jobs_attempts_nonnegative"',
  'CREATE INDEX "files_organization_id_uploaded_by_idx"',
  'CREATE INDEX "extracted_entities_organization_id_document_id_extract_idx"',
  'FOREIGN KEY ("organization_id", "responsible_user_id")',
  'FOREIGN KEY ("organization_id", "case_id")',
  'FOREIGN KEY ("organization_id", "document_id")',
];

for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) {
    throw new Error(`Initial migration is missing the reviewed SQL fragment: ${fragment}`);
  }
}

const delivery5Migration = migrationDirectories.find((name) =>
  name.endsWith('_delivery_5_resource_indexes'),
);

if (delivery5Migration === undefined) {
  throw new Error('The reviewed Delivery 5 resource-index migration is missing.');
}

const delivery5Sql = migrationSql.get(delivery5Migration);
const delivery5Fragments = [
  'CREATE INDEX "persons_active_organization_created_at_id_idx"',
  'CREATE INDEX "cases_active_organization_updated_at_id_idx"',
  'CREATE INDEX "cases_active_organization_status_updated_at_id_idx"',
  'CREATE INDEX "case_participants_organization_case_created_id_idx"',
  'WHERE "deleted_at" IS NULL;',
];

for (const fragment of delivery5Fragments) {
  if (delivery5Sql === undefined || !delivery5Sql.includes(fragment)) {
    throw new Error(`Delivery 5 migration is missing the reviewed SQL fragment: ${fragment}`);
  }
}

const delivery6Migration = migrationDirectories.find((name) =>
  name.endsWith('_delivery_6_secure_file_indexes'),
);

if (delivery6Migration === undefined) {
  throw new Error('The reviewed Delivery 6 secure-file migration is missing.');
}

const delivery6Sql = migrationSql.get(delivery6Migration);
const delivery6Fragments = [
  'CREATE INDEX "files_active_organization_created_at_id_idx"',
  'CREATE INDEX "files_available_organization_checksum_size_created_idx"',
  'CREATE INDEX "documents_active_organization_case_created_at_id_idx"',
  'ADD CONSTRAINT "files_checksum_sha256_lower_hex"',
  'WHERE "deleted_at" IS NULL',
];

for (const fragment of delivery6Fragments) {
  if (delivery6Sql === undefined || !delivery6Sql.includes(fragment)) {
    throw new Error(`Delivery 6 migration is missing the reviewed SQL fragment: ${fragment}`);
  }
}

const delivery7Migration = migrationDirectories.find((name) =>
  name.endsWith('_delivery_7_processing_pipeline'),
);

if (delivery7Migration === undefined) {
  throw new Error('The reviewed Delivery 7 processing-pipeline migration is missing.');
}

const delivery7Sql = migrationSql.get(delivery7Migration);
const delivery7Fragments = [
  'CREATE INDEX "processing_jobs_tenant_created_at_id_idx"',
  'CREATE INDEX "processing_jobs_reconcilable_updated_at_id_idx"',
  'CREATE INDEX "document_extractions_tenant_document_created_at_id_idx"',
  'ADD CONSTRAINT "processing_jobs_lifecycle_consistent"',
  'ADD CONSTRAINT "processing_jobs_error_state_consistent"',
  'ADD CONSTRAINT "document_extractions_confidence_score_bounded"',
  'ADD CONSTRAINT "extracted_entities_offsets_consistent"',
  "WHERE \"status\" IN ('QUEUED', 'RETRYING')",
];

for (const fragment of delivery7Fragments) {
  if (delivery7Sql === undefined || !delivery7Sql.includes(fragment)) {
    throw new Error(`Delivery 7 migration is missing the reviewed SQL fragment: ${fragment}`);
  }
}

for (const [name, migration] of migrationSql) {
  const destructive = /^\s*(DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE)\b/imu.exec(migration);

  if (destructive !== null) {
    throw new Error(`Unexpected destructive SQL in ${name}: ${destructive[0].trim()}`);
  }
}

console.info(`Validated ${migrationDirectories.length} reviewed migration file(s).`);
