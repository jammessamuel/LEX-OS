const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { mkdtemp, open, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-file-intake-integration';
process.env.OBJECT_STORAGE_ENDPOINT = 'http://127.0.0.1:9000';
process.env.OBJECT_STORAGE_PUBLIC_ENDPOINT = 'http://127.0.0.1:9000';
process.env.FILE_INTAKE_MAX_FILE_BYTES = String(6 * 1024 * 1024);

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const DEMO_CASE_ID = '00000000-0000-4000-8000-000000000003';
const READ_ONLY_ROLE_ID = '00000000-0000-4000-8000-000000000106';
const READ_ONLY_USER_ID = '40000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION_ID = '40000000-0000-4000-8000-000000000002';
const OTHER_USER_ID = '40000000-0000-4000-8000-000000000003';
const OTHER_CASE_ID = '40000000-0000-4000-8000-000000000004';
const OTHER_FILE_ID = '40000000-0000-4000-8000-000000000005';
const OTHER_DOCUMENT_ID = '40000000-0000-4000-8000-000000000006';
const OTHER_DOCUMENT_TYPE_ID = '40000000-0000-4000-8000-000000000007';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const READ_ONLY_EMAIL = 'd6-read-only@lexos.invalid';
const PDF = Buffer.from('%PDF-1.7\nconteúdo jurídico inteiramente fictício\n%%EOF\n', 'utf8');
const PDF_HASH = createHash('sha256').update(PDF).digest('hex');

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;
const bucket = process.env.OBJECT_STORAGE_BUCKET;

if (databaseUrl === undefined || seedPassword === undefined || bucket === undefined) {
  throw new Error('Database, seed, and object-storage settings are required for D6 tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
const s3 = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  forcePathStyle: true,
  region: process.env.OBJECT_STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
  },
});

let app;
let http;
let adminToken;
let readOnlyToken;
let firstFileId;
let firstDocumentId;
let firstStorageKey;
let duplicateFileId;
let scannerFailureFileId;
let scannerFailureStorageKey;
let confidentialCaseId;
let confidentialFileId;
let reconciliationService;
let temporaryDirectory;

async function deleteStoredObjectsForFixtures() {
  const result = await pool.query(
    `SELECT storage_bucket, storage_key
     FROM files
     WHERE original_filename LIKE 'd6-%' OR id = $1`,
    [OTHER_FILE_ID],
  );
  for (const row of result.rows) {
    await s3.send(new DeleteObjectCommand({ Bucket: row.storage_bucket, Key: row.storage_key }));
  }

  let continuationToken;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'quarantine/d6-orphan-',
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
      }),
    );
    for (const object of listed.Contents ?? []) {
      if (object.Key !== undefined) {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      }
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken !== undefined);
}

async function cleanup() {
  await deleteStoredObjectsForFixtures();
  await pool.query(
    `DELETE FROM audit_logs
     WHERE organization_id IN ($1, $2)
       AND (action LIKE 'file.%' OR action LIKE 'document.%' OR action LIKE 'case.%' OR action LIKE 'auth.%')`,
    [ORGANIZATION_ID, OTHER_ORGANIZATION_ID],
  );
  await pool.query(
    `DELETE FROM processing_jobs
     WHERE file_id IN (SELECT id FROM files WHERE original_filename LIKE 'd6-%' OR id = $1)`,
    [OTHER_FILE_ID],
  );
  await pool.query(
    `DELETE FROM documents
     WHERE file_id IN (SELECT id FROM files WHERE original_filename LIKE 'd6-%' OR id = $1)`,
    [OTHER_FILE_ID],
  );
  await pool.query("DELETE FROM files WHERE original_filename LIKE 'd6-%' OR id = $1", [
    OTHER_FILE_ID,
  ]);
  await pool.query("DELETE FROM cases WHERE internal_code LIKE 'D6-%' OR id = $1", [OTHER_CASE_ID]);
  await pool.query('DELETE FROM document_types WHERE id = $1', [OTHER_DOCUMENT_TYPE_ID]);
  await pool.query('DELETE FROM refresh_sessions WHERE user_id IN ($1, $2, $3)', [
    ADMIN_USER_ID,
    READ_ONLY_USER_ID,
    OTHER_USER_ID,
  ]);
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [READ_ONLY_USER_ID]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [READ_ONLY_USER_ID, OTHER_USER_ID]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [OTHER_ORGANIZATION_ID]);
}

async function setupFixtures() {
  await pool.query(
    `INSERT INTO organizations
      (id, legal_name, trade_name, document_number, subscription_plan, status, settings, updated_at)
     VALUES ($1, 'Organização D6 Externa Fictícia', 'Tenant D6 Externo', '00000000000000',
       'TEST', 'ACTIVE', '{"fixture":true}', now())`,
    [OTHER_ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Leitor Fictício D6', $3, password_hash, 'ACTIVE', now()
     FROM users WHERE id = $4`,
    [READ_ONLY_USER_ID, ORGANIZATION_ID, READ_ONLY_EMAIL, ADMIN_USER_ID],
  );
  await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
    READ_ONLY_USER_ID,
    READ_ONLY_ROLE_ID,
  ]);
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Usuário D6 Externo Fictício', 'd6-other@lexos.invalid', password_hash,
       'ACTIVE', now()
     FROM users WHERE id = $3`,
    [OTHER_USER_ID, OTHER_ORGANIZATION_ID, ADMIN_USER_ID],
  );
  await pool.query(
    `INSERT INTO cases
      (id, organization_id, internal_code, title, legal_area, case_type, responsible_user_id,
       status, priority, confidentiality_level, updated_at)
     VALUES ($1, $2, 'D6-OTHER-001', 'Caso D6 Externo Fictício', 'TESTE', 'TESTE', $3,
       'INTAKE', 'NORMAL', 'STANDARD', now())`,
    [OTHER_CASE_ID, OTHER_ORGANIZATION_ID, OTHER_USER_ID],
  );
  await pool.query(
    `INSERT INTO files
      (id, organization_id, storage_provider, storage_bucket, storage_key, original_filename,
       mime_type, extension, size_bytes, checksum_sha256, uploaded_by, upload_source,
       virus_scan_status, status, updated_at)
     VALUES ($1, $2, 'MINIO', $3, 'quarantine/other/fictitious', 'd6-other.pdf',
       'application/pdf', 'pdf', $4, $5, $6, 'TEST', 'CLEAN', 'AVAILABLE', now())`,
    [OTHER_FILE_ID, OTHER_ORGANIZATION_ID, bucket, PDF.length, PDF_HASH, OTHER_USER_ID],
  );
  await pool.query(
    `INSERT INTO documents
      (id, organization_id, case_id, file_id, title, processing_status, updated_at)
     VALUES ($1, $2, $3, $4, 'Documento D6 Externo Fictício', 'QUEUED', now())`,
    [OTHER_DOCUMENT_ID, OTHER_ORGANIZATION_ID, OTHER_CASE_ID, OTHER_FILE_ID],
  );
  await pool.query(
    `INSERT INTO document_types
      (id, organization_id, code, name, category, required_fields, is_system, updated_at)
     VALUES ($1, $2, 'D6_OTHER', 'Tipo D6 Externo', 'TESTE', '{}', false, now())`,
    [OTHER_DOCUMENT_TYPE_ID, OTHER_ORGANIZATION_ID],
  );
}

async function login(email) {
  const response = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: 'lex-os-demonstracao', email, password: seedPassword })
    .expect(200);
  return response.body.accessToken;
}

function authorized(method, url, token = adminToken) {
  return request(http)[method](url).set('authorization', `Bearer ${token}`);
}

async function createSyntheticTextFile(filename, sizeBytes) {
  const target = path.join(temporaryDirectory, filename);
  const handle = await open(target, 'w');
  const chunk = Buffer.alloc(64 * 1024, 0x61);
  try {
    let remaining = sizeBytes;
    while (remaining > 0) {
      const current = chunk.subarray(0, Math.min(chunk.length, remaining));
      await handle.write(current);
      remaining -= current.length;
    }
  } finally {
    await handle.close();
  }
  return target;
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lex-os-d6-'));
  await cleanup();
  await setupFixtures();
  const [appModule, platform, configModule, reconciliationModule] = await Promise.all([
    import('../../dist/app.module.js'),
    import('../../dist/http/http-platform.js'),
    import('@lex-os/config'),
    import('../../dist/files/storage-reconciliation.service.js'),
  ]);
  app = await NestFactory.create(appModule.AppModule, { logger: false, abortOnError: false });
  platform.configureHttpPlatform(app, configModule.loadRuntimeConfig());
  await app.init();
  http = app.getHttpServer();
  reconciliationService = app.get(reconciliationModule.StorageReconciliationService);
  adminToken = await login(ADMIN_EMAIL);
  readOnlyToken = await login(READ_ONLY_EMAIL);
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
  s3.destroy();
  if (temporaryDirectory !== undefined) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

describe('Delivery 6 secure file intake and documents', () => {
  it('publishes exactly the implemented file and document routes', async () => {
    const response = await request(http).get('/api/v1/docs/openapi.json').expect(200);
    const paths = response.body.paths;
    assert.ok(paths['/api/v1/cases/{caseId}/files/upload']?.post);
    assert.ok(paths['/api/v1/cases/{caseId}/files']?.get);
    assert.ok(paths['/api/v1/files/{id}/download-url']?.get);
    assert.ok(paths['/api/v1/cases/{caseId}/documents']?.get);
    assert.ok(paths['/api/v1/documents/{id}']?.get);
    assert.ok(paths['/api/v1/documents/{id}']?.patch);
    assert.ok(paths['/api/v1/documents/{id}']?.delete);
    assert.ok(paths['/api/v1/documents/{id}/reprocess']?.post);
    assert.ok(paths['/api/v1/documents/{id}/extractions']?.get);
  });

  it('streams an accepted private PDF to MinIO and persists safe metadata plus a job', async () => {
    const response = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', PDF, { filename: 'd6-contract.pdf', contentType: 'application/pdf' })
      .expect(202);
    assert.equal(response.body.accepted.length, 1);
    assert.equal(response.body.rejected.length, 0);
    const intake = response.body.accepted[0];
    firstFileId = intake.file.id;
    firstDocumentId = intake.file.documentId;
    assert.equal(intake.file.status, 'AVAILABLE');
    assert.equal(intake.file.virusScanStatus, 'CLEAN');
    assert.equal(intake.job.jobType, 'FILE_VALIDATION');
    assert.equal(intake.job.status, 'QUEUED');

    const stored = await pool.query(
      `SELECT f.storage_key, f.checksum_sha256, f.size_bytes, f.duplicate_of_file_id,
              d.id AS document_id, j.id AS job_id
       FROM files f
       JOIN documents d ON d.organization_id = f.organization_id AND d.file_id = f.id
       JOIN processing_jobs j ON j.organization_id = f.organization_id AND j.file_id = f.id
       WHERE f.id = $1 AND f.organization_id = $2`,
      [firstFileId, ORGANIZATION_ID],
    );
    assert.equal(stored.rowCount, 1);
    firstStorageKey = stored.rows[0].storage_key;
    assert.equal(stored.rows[0].checksum_sha256, PDF_HASH);
    assert.equal(Number(stored.rows[0].size_bytes), PDF.length);
    assert.equal(stored.rows[0].duplicate_of_file_id, null);
    assert.equal(stored.rows[0].document_id, firstDocumentId);
    assert.match(firstStorageKey, /^quarantine\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/u);
    assert.equal(firstStorageKey.includes('d6-contract'), false);
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: firstStorageKey }));

    const anonymous = await fetch(`http://127.0.0.1:9000/${bucket}/${firstStorageKey}`);
    assert.equal(anonymous.status, 403);
  });

  it('generates only short-lived authorized URLs and returns the original bytes', async () => {
    const response = await authorized('get', `/api/v1/files/${firstFileId}/download-url`).expect(
      200,
    );
    const signed = new URL(response.body.url);
    assert.equal(signed.searchParams.get('X-Amz-Expires'), '60');
    const downloaded = await fetch(signed);
    assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), PDF);
  });

  it('streams a multipart object larger than one S3 part without storing binary data in PostgreSQL', async () => {
    const largePath = await createSyntheticTextFile('d6-large.txt', 5_500_000);
    const response = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', largePath, { filename: 'd6-large.txt', contentType: 'text/plain' })
      .expect(202);
    assert.equal(response.body.accepted[0].file.sizeBytes, 5_500_000);
    const columns = await pool.query(
      `SELECT count(*)::int AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('files', 'documents')
         AND data_type = 'bytea'`,
    );
    assert.equal(columns.rows[0].count, 0);
  });

  it('records same-tenant duplicates without linking or disclosing another tenant', async () => {
    const response = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', PDF, { filename: 'd6-duplicate.pdf', contentType: 'application/pdf' })
      .expect(202);
    duplicateFileId = response.body.accepted[0].file.id;
    assert.equal(response.body.accepted[0].file.duplicateOfFileId, firstFileId);
    assert.notEqual(response.body.accepted[0].file.duplicateOfFileId, OTHER_FILE_ID);

    await authorized('get', `/api/v1/cases/${OTHER_CASE_ID}/files`).expect(404);
    await authorized('get', `/api/v1/cases/${OTHER_CASE_ID}/documents`).expect(404);
    await authorized('get', `/api/v1/files/${OTHER_FILE_ID}/download-url`).expect(404);
    await authorized('get', `/api/v1/documents/${OTHER_DOCUMENT_ID}`).expect(404);
    await authorized('post', `/api/v1/cases/${OTHER_CASE_ID}/files/upload`)
      .attach('files', PDF, { filename: 'd6-foreign.pdf', contentType: 'application/pdf' })
      .expect(404);
    await authorized('patch', `/api/v1/documents/${OTHER_DOCUMENT_ID}`)
      .send({ title: 'Tentativa externa fictícia' })
      .expect(404);
    await authorized('delete', `/api/v1/documents/${OTHER_DOCUMENT_ID}`).expect(404);
  });

  it('rejects mismatched MIME, path traversal, infection, and oversized content safely', async () => {
    const mismatch = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', Buffer.from('texto fictício'), {
        filename: 'd6-mismatch.pdf',
        contentType: 'application/pdf',
      })
      .expect(415);
    assert.equal(mismatch.body.code, 'FILE_MIME_MISMATCH');

    const boundary = `lex-os-${randomUUID()}`;
    const traversalBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="../d6-escape.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
        'utf8',
      ),
      PDF,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);
    const traversal = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .set('content-type', `multipart/form-data; boundary=${boundary}`)
      .send(traversalBody)
      .expect(400);
    assert.equal(traversal.body.code, 'INVALID_FILE_NAME');

    const infected = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), {
        filename: 'd6-infected.txt',
        contentType: 'text/plain',
      })
      .expect(422);
    assert.equal(infected.body.code, 'INFECTED_FILE');

    const oversizedPath = await createSyntheticTextFile('d6-oversized.txt', 6 * 1024 * 1024 + 1);
    const oversized = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', oversizedPath, { filename: 'd6-oversized.txt', contentType: 'text/plain' })
      .expect(413);
    assert.equal(oversized.body.code, 'FILE_TOO_LARGE');

    let excessiveCount = authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`);
    for (let index = 0; index < 11; index += 1) {
      excessiveCount = excessiveCount.attach('files', PDF, {
        filename: `d6-count-${index}.pdf`,
        contentType: 'application/pdf',
      });
    }
    const countResponse = await excessiveCount.expect(413);
    assert.equal(countResponse.body.code, 'FILE_COUNT_LIMIT_EXCEEDED');
    const countRows = await pool.query(
      "SELECT count(*)::int AS count FROM files WHERE original_filename LIKE 'd6-count-%'",
    );
    assert.equal(countRows.rows[0].count, 0);
  });

  it('keeps scanner failures quarantined and denies URL generation', async () => {
    const response = await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`)
      .attach('files', Buffer.from('LEXOS_MOCK_SCANNER_UNAVAILABLE'), {
        filename: 'd6-scanner-failure.txt',
        contentType: 'text/plain',
      })
      .expect(202);
    const intake = response.body.accepted[0];
    scannerFailureFileId = intake.file.id;
    assert.equal(intake.file.status, 'QUARANTINED');
    assert.equal(intake.file.virusScanStatus, 'ERROR');
    assert.equal(intake.job.jobType, 'VIRUS_SCAN');
    await authorized('get', `/api/v1/files/${scannerFailureFileId}/download-url`).expect(409);
    const row = await pool.query('SELECT storage_key FROM files WHERE id = $1', [
      scannerFailureFileId,
    ]);
    scannerFailureStorageKey = row.rows[0].storage_key;
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: scannerFailureStorageKey }));
  });

  it('supports authorized document listing, detail, correction, and soft deletion', async () => {
    const list = await authorized('get', `/api/v1/cases/${DEMO_CASE_ID}/documents?limit=1`).expect(
      200,
    );
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.pageInfo.hasNextPage, true);
    await authorized('get', `/api/v1/documents/${firstDocumentId}`).expect(200);

    const updated = await authorized('patch', `/api/v1/documents/${firstDocumentId}`)
      .send({
        title: 'Contrato fictício revisado',
        documentTypeId: '00000000-0000-4000-8000-000000000306',
      })
      .expect(200);
    assert.equal(updated.body.classificationStatus, 'CLASSIFIED');
    assert.equal(updated.body.documentType.code, 'CONTRATO');

    const foreignType = await authorized('patch', `/api/v1/documents/${firstDocumentId}`)
      .send({ documentTypeId: OTHER_DOCUMENT_TYPE_ID })
      .expect(400);
    assert.equal(foreignType.body.code, 'INVALID_DOCUMENT_TYPE');

    await authorized('patch', `/api/v1/documents/${firstDocumentId}`, readOnlyToken)
      .send({ title: 'Tentativa sem permissão' })
      .expect(403);
    await authorized('delete', `/api/v1/documents/${firstDocumentId}`, readOnlyToken).expect(403);

    await authorized('delete', `/api/v1/documents/${duplicateFileId}`).expect(404);
  });

  it('denies unauthorized upload and confidential reads before any download URL is generated', async () => {
    await authorized('post', `/api/v1/cases/${DEMO_CASE_ID}/files/upload`, readOnlyToken)
      .attach('files', PDF, { filename: 'd6-denied.pdf', contentType: 'application/pdf' })
      .expect(403);

    const createdCase = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D6-CONF-001',
        title: 'Caso confidencial D6 fictício',
        legalArea: 'TESTE',
        caseType: 'TESTE',
        confidentialityLevel: 'CONFIDENTIAL',
      })
      .expect(201);
    confidentialCaseId = createdCase.body.id;
    const upload = await authorized('post', `/api/v1/cases/${confidentialCaseId}/files/upload`)
      .attach('files', PDF, { filename: 'd6-confidential.pdf', contentType: 'application/pdf' })
      .expect(202);
    confidentialFileId = upload.body.accepted[0].file.id;

    await authorized(
      'get',
      `/api/v1/files/${confidentialFileId}/download-url`,
      readOnlyToken,
    ).expect(404);
    await authorized('get', `/api/v1/cases/${confidentialCaseId}/documents`, readOnlyToken).expect(
      404,
    );
  });

  it('reports missing and orphaned objects without deleting them automatically', async () => {
    const beforeReport = await reconciliationService.report(ORGANIZATION_ID);
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: scannerFailureStorageKey }));
    const orphanKey = `quarantine/d6-orphan-${randomUUID()}`;
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: orphanKey, Body: Buffer.from('orphan fixture') }),
    );
    const report = await reconciliationService.report(ORGANIZATION_ID);
    assert.equal(report.missingObjectFileIds.includes(scannerFailureFileId), true);
    assert.ok(report.orphanObjectCount >= beforeReport.orphanObjectCount + 1);
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: orphanKey }));
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: orphanKey }));
  });

  it('uses strict audit allowlists and soft-deletes document/file metadata without deleting evidence', async () => {
    const auditRows = await pool.query(
      `SELECT action, old_data, new_data
       FROM audit_logs
       WHERE organization_id = $1
         AND (action LIKE 'file.%' OR action LIKE 'document.%')`,
      [ORGANIZATION_ID],
    );
    const serialized = JSON.stringify(auditRows.rows);
    assert.ok(auditRows.rowCount >= 8);
    assert.equal(serialized.includes('d6-contract.pdf'), false);
    assert.equal(serialized.includes(PDF_HASH), false);
    assert.equal(serialized.includes(firstStorageKey), false);
    assert.equal(serialized.includes('conteúdo jurídico'), false);
    assert.equal(serialized.includes('X-Amz-Signature'), false);

    await authorized('delete', `/api/v1/documents/${firstDocumentId}`).expect(204);
    await authorized('get', `/api/v1/documents/${firstDocumentId}`).expect(404);
    await authorized('get', `/api/v1/files/${firstFileId}/download-url`).expect(404);
    const softDeleted = await pool.query(
      `SELECT d.deleted_at AS document_deleted_at, f.deleted_at AS file_deleted_at
       FROM documents d JOIN files f ON f.id = d.file_id
       WHERE d.id = $1`,
      [firstDocumentId],
    );
    assert.ok(softDeleted.rows[0].document_deleted_at);
    assert.ok(softDeleted.rows[0].file_deleted_at);
    const deletionAudit = await pool.query(
      `SELECT count(*)::int AS count
       FROM audit_logs
       WHERE organization_id = $1
         AND action = 'document.deleted'
         AND entity_id = $2`,
      [ORGANIZATION_ID, firstDocumentId],
    );
    assert.equal(deletionAudit.rows[0].count, 1);
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: firstStorageKey }));
  });
});
