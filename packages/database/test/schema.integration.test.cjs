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
    assert.equal(tables.rows[0].count, 25);
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
          (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'Organização A', 'A', 'A', 'TEST', now()),
                ($2, 'Organização B', 'B', 'B', 'TEST', now())`,
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
          (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'Organização A', 'A', 'A2', 'TEST', now()),
                ($2, 'Organização B', 'B', 'B2', 'TEST', now())`,
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
          (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'Organização', 'O', 'O1', 'TEST', now())`,
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
          (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'Organização D6', 'D6', 'D6', 'TEST', now())`,
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
          (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
         VALUES ($1, 'Organização D7', 'D7', 'D7', 'TEST', now())`,
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
