const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { Pool } = require('pg');

try {
  process.loadEnvFile(path.resolve(__dirname, '../../../.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });

const id = (suffix) => `10000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

async function expectDatabaseError(client, statement, parameters, expectedCode) {
  await client.query('SAVEPOINT expected_failure');
  let caught;

  try {
    await client.query(statement, parameters);
  } catch (error) {
    caught = error;
  }

  await client.query('ROLLBACK TO SAVEPOINT expected_failure');
  await client.query('RELEASE SAVEPOINT expected_failure');
  assert.ok(caught, `Expected PostgreSQL error ${expectedCode}.`);
  assert.equal(caught.code, expectedCode);
}

async function inRolledBackTransaction(operation) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await operation(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

before(async () => {
  await pool.query('SELECT 1');
});

after(async () => {
  await pool.end();
});

describe('initial database migration', () => {
  it('installs the required extensions and schema objects', async () => {
    const extensions = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto', 'vector') ORDER BY extname",
    );
    const tables = await pool.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );

    assert.deepEqual(
      extensions.rows.map((row) => row.extname),
      ['pgcrypto', 'vector'],
    );
    assert.equal(tables.rows[0].count, 28);
  });

  it('installs the Delivery 9 generated search vector and tenant-first indexes', async () => {
    const column = await pool.query(
      `SELECT is_generated, generation_expression
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'knowledge_chunks'
         AND column_name = 'search_vector'`,
    );
    assert.equal(column.rowCount, 1);
    assert.equal(column.rows[0].is_generated, 'ALWAYS');
    assert.match(column.rows[0].generation_expression, /to_tsvector\('portuguese'/u);

    const indexes = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'knowledge_chunks_search_vector_gin_idx',
           'knowledge_chunks_tenant_source_lookup_idx',
           'knowledge_chunks_tenant_embedding_scope_idx'
         )
       ORDER BY indexname`,
    );
    assert.deepEqual(
      indexes.rows.map((row) => row.indexname),
      [
        'knowledge_chunks_search_vector_gin_idx',
        'knowledge_chunks_tenant_embedding_scope_idx',
        'knowledge_chunks_tenant_source_lookup_idx',
      ],
    );
    assert.match(
      indexes.rows.find((row) => row.indexname === 'knowledge_chunks_search_vector_gin_idx')
        .indexdef,
      /USING gin \(search_vector\)/iu,
    );
  });

  it('rejects representative cross-tenant relationships', async () => {
    await inRolledBackTransaction(async (client) => {
      const organizationA = id(1);
      const organizationB = id(2);
      const userA = id(3);
      const caseB = id(4);
      const personA = id(5);

      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-a', 'Organização A', 'A', 'A', 'TEST', now()),
                ($2, 'org-b', 'Organização B', 'B', 'B', 'TEST', now())`,
        [organizationA, organizationB],
      );
      await client.query(
        `INSERT INTO users
          (id, organization_id, name, email, password_hash, status, updated_at)
         VALUES ($1, $2, 'Usuário A', 'a@example.invalid', 'argon2id-test-hash', 'ACTIVE', now())`,
        [userA, organizationA],
      );

      await expectDatabaseError(
        client,
        `INSERT INTO cases
          (id, organization_id, internal_code, title, legal_area, case_type, responsible_user_id, updated_at)
         VALUES ($1, $2, 'B-001', 'Caso B', 'TEST', 'TEST', $3, now())`,
        [caseB, organizationB, userA],
        '23503',
      );

      await client.query(
        `INSERT INTO cases
          (id, organization_id, internal_code, title, legal_area, case_type, updated_at)
         VALUES ($1, $2, 'B-001', 'Caso B', 'TEST', 'TEST', now())`,
        [caseB, organizationB],
      );
      await client.query(
        `INSERT INTO persons
          (id, organization_id, person_type, full_name, updated_at)
         VALUES ($1, $2, 'INDIVIDUAL', 'Pessoa A', now())`,
        [personA, organizationA],
      );

      await expectDatabaseError(
        client,
        `INSERT INTO case_participants
          (id, organization_id, case_id, person_id, role, updated_at)
         VALUES ($1, $2, $3, $4, 'CLIENTE', now())`,
        [id(6), organizationB, caseB, personA],
        '23503',
      );
    });
  });

  it('enforces global and organization-scoped partial uniqueness', async () => {
    await inRolledBackTransaction(async (client) => {
      const organizationA = id(11);
      const organizationB = id(12);

      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-a2', 'Organização A', 'A', 'A2', 'TEST', now()),
                ($2, 'org-b2', 'Organização B', 'B', 'B2', 'TEST', now())`,
        [organizationA, organizationB],
      );
      await client.query(
        `INSERT INTO roles (id, organization_id, name, code, updated_at)
         VALUES ($1, NULL, 'Global', 'TEST_ROLE', now()),
                ($2, $3, 'Tenant A', 'TEST_ROLE', now()),
                ($4, $5, 'Tenant B', 'TEST_ROLE', now())`,
        [id(13), id(14), organizationA, id(15), organizationB],
      );

      await expectDatabaseError(
        client,
        `INSERT INTO roles (id, organization_id, name, code, updated_at)
         VALUES ($1, NULL, 'Global duplicado', 'TEST_ROLE', now())`,
        [id(16)],
        '23505',
      );
      await expectDatabaseError(
        client,
        `INSERT INTO roles (id, organization_id, name, code, updated_at)
         VALUES ($1, $2, 'Tenant duplicado', 'TEST_ROLE', now())`,
        [id(17), organizationA],
        '23505',
      );
    });
  });

  it('rejects invalid check-constrained values', async () => {
    await inRolledBackTransaction(async (client) => {
      const organization = id(21);
      const user = id(22);

      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-o1', 'Organização', 'O', 'O1', 'TEST', now())`,
        [organization],
      );
      await client.query(
        `INSERT INTO users
          (id, organization_id, name, email, password_hash, status, updated_at)
         VALUES ($1, $2, 'Usuário', 'user@example.invalid', 'argon2id-test-hash', 'ACTIVE', now())`,
        [user, organization],
      );

      await expectDatabaseError(
        client,
        `INSERT INTO files
          (id, organization_id, storage_provider, storage_bucket, storage_key,
           original_filename, mime_type, extension, size_bytes, checksum_sha256,
           uploaded_by, upload_source, updated_at)
         VALUES ($1, $2, 'test', 'test', 'negative-size', 'test.txt', 'text/plain',
                 'txt', -1, $3, $4, 'TEST', now())`,
        [id(23), organization, '0'.repeat(64), user],
        '23514',
      );
    });
  });
});

describe('Delivery 5 resource indexes', () => {
  it('installs the tenant-first indexes used by resource queries', async () => {
    const result = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          'case_participants_organization_case_created_id_idx',
          'cases_active_organization_status_updated_at_id_idx',
          'cases_active_organization_updated_at_id_idx',
          'persons_active_organization_created_at_id_idx',
        ],
      ],
    );

    assert.deepEqual(
      result.rows.map((row) => row.indexname),
      [
        'case_participants_organization_case_created_id_idx',
        'cases_active_organization_status_updated_at_id_idx',
        'cases_active_organization_updated_at_id_idx',
        'persons_active_organization_created_at_id_idx',
      ],
    );

    for (const row of result.rows.filter(
      (entry) => entry.indexname !== 'case_participants_organization_case_created_id_idx',
    )) {
      assert.match(row.indexdef, /WHERE \(deleted_at IS NULL\)$/);
    }
  });
});

describe('Delivery 6 secure file metadata', () => {
  it('installs active-resource and same-tenant duplicate lookup indexes', async () => {
    const result = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          'documents_active_organization_case_created_at_id_idx',
          'files_active_organization_created_at_id_idx',
          'files_available_organization_checksum_size_created_idx',
        ],
      ],
    );

    assert.deepEqual(
      result.rows.map((row) => row.indexname),
      [
        'documents_active_organization_case_created_at_id_idx',
        'files_active_organization_created_at_id_idx',
        'files_available_organization_checksum_size_created_idx',
      ],
    );
    for (const row of result.rows) {
      assert.match(row.indexdef, /WHERE /);
    }
  });

  it('rejects malformed checksums and has no binary file/document columns', async () => {
    const binaryColumns = await pool.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('files', 'documents')
         AND data_type = 'bytea'`,
    );
    assert.equal(binaryColumns.rowCount, 0);

    await inRolledBackTransaction(async (client) => {
      const organization = id(31);
      const user = id(32);
      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-d6', 'Organização D6', 'D6', 'D6', 'TEST', now())`,
        [organization],
      );
      await client.query(
        `INSERT INTO users
          (id, organization_id, name, email, password_hash, status, updated_at)
         VALUES ($1, $2, 'Usuário D6', 'd6@example.invalid', 'argon2id-test-hash', 'ACTIVE', now())`,
        [user, organization],
      );
      await expectDatabaseError(
        client,
        `INSERT INTO files
          (id, organization_id, storage_provider, storage_bucket, storage_key,
           original_filename, mime_type, extension, size_bytes, checksum_sha256,
           uploaded_by, upload_source, virus_scan_status, status, updated_at)
         VALUES ($1, $2, 'MINIO', 'test', 'quarantine/test', 'test.txt', 'text/plain',
                 'txt', 4, 'NOT-A-SHA256', $3, 'TEST', 'CLEAN', 'AVAILABLE', now())`,
        [id(33), organization, user],
        '23514',
      );
    });
  });
});

describe('Delivery 7 processing pipeline metadata', () => {
  it('installs progress/reconciliation indexes and lifecycle constraints', async () => {
    const indexes = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          'document_extractions_tenant_document_created_at_id_idx',
          'processing_jobs_reconcilable_updated_at_id_idx',
          'processing_jobs_tenant_created_at_id_idx',
        ],
      ],
    );
    assert.deepEqual(
      indexes.rows.map((row) => row.indexname),
      [
        'document_extractions_tenant_document_created_at_id_idx',
        'processing_jobs_reconcilable_updated_at_id_idx',
        'processing_jobs_tenant_created_at_id_idx',
      ],
    );
    assert.match(
      indexes.rows.find((row) => row.indexname.includes('reconcilable')).indexdef,
      /WHERE \(status = ANY/iu,
    );

    const constraints = await pool.query(
      `SELECT conname
       FROM pg_constraint
       WHERE conrelid IN (
         'processing_jobs'::regclass,
         'document_extractions'::regclass,
         'extracted_entities'::regclass
       )
         AND conname = ANY($1::text[])
       ORDER BY conname`,
      [
        [
          'document_extractions_confidence_score_bounded',
          'extracted_entities_offsets_consistent',
          'processing_jobs_error_state_consistent',
          'processing_jobs_lifecycle_consistent',
        ],
      ],
    );
    assert.equal(constraints.rowCount, 4);
  });

  it('rejects inconsistent job terminal state and extraction source locations', async () => {
    await inRolledBackTransaction(async (client) => {
      const organization = id(41);
      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-d7', 'Organização D7', 'D7', 'D7', 'TEST', now())`,
        [organization],
      );
      await expectDatabaseError(
        client,
        `INSERT INTO processing_jobs
          (id, organization_id, job_type, status, updated_at)
         VALUES ($1, $2, 'OCR', 'COMPLETED', now())`,
        [id(42), organization],
        '23514',
      );
    });
  });
});

describe('Delivery 8 timeline and checklist review invariants', () => {
  it('installs tenant/case source constraints and traceable-task indexes', async () => {
    const constraints = await pool.query(
      `SELECT conname
       FROM pg_constraint
       WHERE conname = ANY($1::text[])
       ORDER BY conname`,
      [
        [
          'case_checklist_items_organization_id_case_id_document_id_fkey',
          'case_checklist_items_validation_consistent',
          'timeline_events_ai_source_required',
          'timeline_events_organization_id_case_id_source_id_fkey',
        ],
      ],
    );
    assert.deepEqual(
      constraints.rows.map((row) => row.conname),
      [
        'case_checklist_items_organization_id_case_id_document_id_fkey',
        'case_checklist_items_validation_consistent',
        'timeline_events_ai_source_required',
        'timeline_events_organization_id_case_id_source_id_fkey',
      ],
    );

    const indexes = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          'case_checklists_tenant_case_created_at_id_idx',
          'case_checklist_items_organization_id_case_id_document_id_idx',
          'tasks_active_ai_checklist_source_key',
          'tasks_active_tenant_case_created_at_id_idx',
          'timeline_events_tenant_case_created_at_id_idx',
          'timeline_events_organization_id_source_id_extraction_id_idx',
        ],
      ],
    );
    assert.equal(indexes.rowCount, 6);
    assert.match(
      indexes.rows.find((row) => row.indexname === 'tasks_active_ai_checklist_source_key').indexdef,
      /WHERE/iu,
    );
    assert.match(
      indexes.rows.find((row) => row.indexname === 'tasks_active_tenant_case_created_at_id_idx')
        .indexdef,
      /WHERE \(deleted_at IS NULL\)$/iu,
    );
  });

  it('rejects unsourced AI events and cross-case event/checklist links', async () => {
    await inRolledBackTransaction(async (client) => {
      const organization = id(51);
      const user = id(52);
      const caseA = id(53);
      const caseB = id(54);
      const file = id(55);
      const document = id(56);
      const extraction = id(57);
      const template = id(58);
      const templateItem = id(59);
      const checklist = id(60);
      const checklistItem = id(61);

      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-d8', 'Organização D8', 'D8', 'D8', 'TEST', now())`,
        [organization],
      );
      await client.query(
        `INSERT INTO users
          (id, organization_id, name, email, password_hash, status, updated_at)
         VALUES ($1, $2, 'Usuário D8', 'd8@example.invalid', 'argon2id-test-hash', 'ACTIVE', now())`,
        [user, organization],
      );
      await client.query(
        `INSERT INTO cases
          (id, organization_id, internal_code, title, legal_area, case_type, updated_at)
         VALUES ($1, $2, 'D8-A', 'Caso A', 'TEST', 'TEST', now()),
                ($3, $2, 'D8-B', 'Caso B', 'TEST', 'TEST', now())`,
        [caseA, organization, caseB],
      );
      await client.query(
        `INSERT INTO files
          (id, organization_id, storage_provider, storage_bucket, storage_key,
           original_filename, mime_type, extension, size_bytes, checksum_sha256,
           uploaded_by, upload_source, updated_at)
         VALUES ($1, $2, 'test', 'test', 'd8-source', 'd8.txt', 'text/plain',
                 'txt', 10, $3, $4, 'TEST', now())`,
        [file, organization, 'a'.repeat(64), user],
      );
      await client.query(
        `INSERT INTO documents
          (id, organization_id, case_id, file_id, title, updated_at)
         VALUES ($1, $2, $3, $4, 'Documento D8', now())`,
        [document, organization, caseA, file],
      );
      await client.query(
        `INSERT INTO document_extractions
          (id, organization_id, document_id, extraction_type, provider, model_name,
           execution_id, status)
         VALUES ($1, $2, $3, 'TIMELINE_ANALYSIS', 'fixture', 'v1', 'd8-execution', 'COMPLETED')`,
        [extraction, organization, document],
      );

      await expectDatabaseError(
        client,
        `INSERT INTO timeline_events
          (id, organization_id, case_id, event_type, title, description, date_precision,
           source_type, created_by_actor_type, updated_at)
         VALUES ($1, $2, $3, 'DATE', 'Evento', 'Fixture', 'DAY', 'DOCUMENT', 'AI', now())`,
        [id(62), organization, caseA],
        '23514',
      );
      await expectDatabaseError(
        client,
        `INSERT INTO timeline_events
          (id, organization_id, case_id, event_type, title, description, date_precision,
           source_type, source_id, source_locator, extraction_id, created_by_actor_type, updated_at)
         VALUES ($1, $2, $3, 'DATE', 'Evento', 'Fixture', 'DAY', 'DOCUMENT', $4,
                 '{"pageNumber":1,"startOffset":0,"endOffset":1}', $5, 'AI', now())`,
        [id(63), organization, caseB, document, extraction],
        '23503',
      );

      await client.query(
        `INSERT INTO checklist_templates
          (id, name, legal_area, case_type, version, updated_at)
         VALUES ($1, 'Template D8', 'TEST', 'TEST', 1, now())`,
        [template],
      );
      await client.query(
        `INSERT INTO checklist_template_items
          (id, template_id, title, is_required, sort_order)
         VALUES ($1, $2, 'Item D8', true, 1)`,
        [templateItem, template],
      );
      await client.query(
        `INSERT INTO case_checklists
          (id, organization_id, case_id, template_id, template_version, updated_at)
         VALUES ($1, $2, $3, $4, 1, now())`,
        [checklist, organization, caseB, template],
      );
      await expectDatabaseError(
        client,
        `INSERT INTO case_checklist_items
          (id, organization_id, case_id, case_checklist_id, template_item_id,
           title_snapshot, is_required_snapshot, status, document_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'Item D8', true, 'AWAITING_VALIDATION', $6, now())`,
        [checklistItem, organization, caseB, checklist, templateItem, document],
        '23503',
      );
    });
  });

  it('allows only one active task per AI checklist source', async () => {
    await inRolledBackTransaction(async (client) => {
      const organization = id(71);
      const user = id(72);
      const caseId = id(73);
      const template = id(74);
      const templateItem = id(75);
      const checklist = id(76);
      const checklistItem = id(77);

      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-d8t', 'Organização D8 Task', 'D8T', 'D8T', 'TEST', now())`,
        [organization],
      );
      await client.query(
        `INSERT INTO users
          (id, organization_id, name, email, password_hash, status, updated_at)
         VALUES ($1, $2, 'Usuário D8 Task', 'd8-task@example.invalid', 'argon2id-test-hash', 'ACTIVE', now())`,
        [user, organization],
      );
      await client.query(
        `INSERT INTO cases
          (id, organization_id, internal_code, title, legal_area, case_type, updated_at)
         VALUES ($1, $2, 'D8-TASK', 'Caso Task', 'TEST', 'TEST', now())`,
        [caseId, organization],
      );
      await client.query(
        `INSERT INTO checklist_templates
          (id, name, legal_area, case_type, version, updated_at)
         VALUES ($1, 'Template Task', 'TEST', 'TEST', 1, now())`,
        [template],
      );
      await client.query(
        `INSERT INTO checklist_template_items
          (id, template_id, title, is_required, sort_order)
         VALUES ($1, $2, 'Item Task', true, 1)`,
        [templateItem, template],
      );
      await client.query(
        `INSERT INTO case_checklists
          (id, organization_id, case_id, template_id, template_version, updated_at)
         VALUES ($1, $2, $3, $4, 1, now())`,
        [checklist, organization, caseId, template],
      );
      await client.query(
        `INSERT INTO case_checklist_items
          (id, organization_id, case_id, case_checklist_id, template_item_id,
           title_snapshot, is_required_snapshot, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'Item Task', true, 'MISSING', now())`,
        [checklistItem, organization, caseId, checklist, templateItem],
      );
      await client.query(
        `INSERT INTO tasks
          (id, organization_id, case_id, title, task_type, source_type, source_id,
           created_by, updated_at)
         VALUES ($1, $2, $3, 'Tarefa D8', 'DOCUMENT_COLLECTION', 'AI_CHECKLIST', $4, $5, now())`,
        [id(78), organization, caseId, checklistItem, user],
      );
      await expectDatabaseError(
        client,
        `INSERT INTO tasks
          (id, organization_id, case_id, title, task_type, source_type, source_id,
           created_by, updated_at)
         VALUES ($1, $2, $3, 'Tarefa D8 duplicada', 'DOCUMENT_COLLECTION',
                 'AI_CHECKLIST', $4, $5, now())`,
        [id(79), organization, caseId, checklistItem, user],
        '23505',
      );
    });
  });
});

describe('Delivery 10 human review and processing cost invariants', () => {
  it('installs the entity-review and cost constraints and tenant-first indexes', async () => {
    const constraints = await pool.query(
      `SELECT conname
       FROM pg_constraint
       WHERE conname = ANY($1::text[])
       ORDER BY conname`,
      [
        [
          'cases_processing_budget_state_consistent',
          'cases_processing_cost_within_limit',
          'extracted_entities_confirmation_consistent',
          'extracted_entities_organization_id_confirmed_by_fkey',
          'processing_jobs_completed_cost_recorded',
          'processing_jobs_cost_nonnegative',
        ],
      ],
    );
    assert.deepEqual(
      constraints.rows.map((row) => row.conname),
      [
        'cases_processing_budget_state_consistent',
        'cases_processing_cost_within_limit',
        'extracted_entities_confirmation_consistent',
        'extracted_entities_organization_id_confirmed_by_fkey',
        'processing_jobs_completed_cost_recorded',
        'processing_jobs_cost_nonnegative',
      ],
    );

    const indexes = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          'extracted_entities_organization_id_confirmed_by_idx',
          'processing_jobs_organization_id_case_id_provider_model_name_idx',
        ],
      ],
    );
    assert.deepEqual(
      indexes.rows.map((row) => row.indexname),
      [
        'extracted_entities_organization_id_confirmed_by_idx',
        'processing_jobs_organization_id_case_id_provider_model_name_idx',
      ],
    );
  });

  it('rejects inconsistent review attribution and cost state', async () => {
    await inRolledBackTransaction(async (client) => {
      const organizationA = id(81);
      const organizationB = id(82);
      const userA = id(83);
      const userB = id(84);
      const caseA = id(85);
      const fileA = id(86);
      const documentA = id(87);
      const extractionA = id(88);
      const entityA = id(89);

      await client.query(
        `INSERT INTO organizations
          (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'org-d10a', 'Organização D10 A', 'D10A', 'D10A', 'TEST', now()),
                ($2, 'org-d10b', 'Organização D10 B', 'D10B', 'D10B', 'TEST', now())`,
        [organizationA, organizationB],
      );
      await client.query(
        `INSERT INTO users
          (id, organization_id, name, email, password_hash, status, updated_at)
         VALUES ($1, $2, 'Usuário D10 A', 'd10-a@example.invalid', 'argon2id-test-hash', 'ACTIVE', now()),
                ($3, $4, 'Usuário D10 B', 'd10-b@example.invalid', 'argon2id-test-hash', 'ACTIVE', now())`,
        [userA, organizationA, userB, organizationB],
      );
      await client.query(
        `INSERT INTO cases
          (id, organization_id, internal_code, title, legal_area, case_type, updated_at)
         VALUES ($1, $2, 'D10-A', 'Caso D10', 'TEST', 'TEST', now())`,
        [caseA, organizationA],
      );
      await client.query(
        `INSERT INTO files
          (id, organization_id, storage_provider, storage_bucket, storage_key,
           original_filename, mime_type, extension, size_bytes, checksum_sha256,
           uploaded_by, upload_source, updated_at)
         VALUES ($1, $2, 'test', 'test', 'd10-source', 'd10.txt', 'text/plain',
                 'txt', 10, $3, $4, 'TEST', now())`,
        [fileA, organizationA, 'b'.repeat(64), userA],
      );
      await client.query(
        `INSERT INTO documents
          (id, organization_id, case_id, file_id, title, updated_at)
         VALUES ($1, $2, $3, $4, 'Documento D10', now())`,
        [documentA, organizationA, caseA, fileA],
      );
      await client.query(
        `INSERT INTO document_extractions
          (id, organization_id, document_id, extraction_type, provider, model_name,
           execution_id, status)
         VALUES ($1, $2, $3, 'ENTITY_EXTRACTION', 'fixture', 'v1', 'd10-execution', 'COMPLETED')`,
        [extractionA, organizationA, documentA],
      );
      await client.query(
        `INSERT INTO extracted_entities
          (id, organization_id, document_id, extraction_id, entity_type,
           normalized_value, original_value)
         VALUES ($1, $2, $3, $4, 'DATE', '2026-08-13', '13/08/2026')`,
        [entityA, organizationA, documentA, extractionA],
      );

      await expectDatabaseError(
        client,
        `UPDATE extracted_entities
         SET confirmed_by_user = true
         WHERE id = $1`,
        [entityA],
        '23514',
      );
      await expectDatabaseError(
        client,
        `UPDATE extracted_entities
         SET confirmed_by_user = true, confirmed_by = $2, confirmed_at = now()
         WHERE id = $1`,
        [entityA, userB],
        '23503',
      );
      await expectDatabaseError(
        client,
        `UPDATE cases
         SET processing_cost_spent_amount = 0.000001
         WHERE id = $1`,
        [caseA],
        '23514',
      );
      await expectDatabaseError(
        client,
        `INSERT INTO processing_jobs
          (id, organization_id, case_id, job_type, status, provider, model_name,
           model_version, reserved_cost_amount, cost_amount, started_at, finished_at, updated_at)
         VALUES ($1, $2, $3, 'OCR', 'COMPLETED', 'fixture', 'v1', '1',
                 0.000001, 0, now(), now(), now())`,
        [id(90), organizationA, caseA],
        '23514',
      );
    });
  });
});
