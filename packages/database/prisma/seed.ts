import { fileURLToPath } from 'node:url';

import argon2 from 'argon2';

import { createPrismaClient, withTransaction } from '../src/client.js';

const IDS = {
  organization: '00000000-0000-4000-8000-000000000001',
  adminUser: '00000000-0000-4000-8000-000000000002',
  demoCase: '00000000-0000-4000-8000-000000000003',
  adminRole: '00000000-0000-4000-8000-000000000101',
  lawyerRole: '00000000-0000-4000-8000-000000000102',
  assistantRole: '00000000-0000-4000-8000-000000000103',
  partnerRole: '00000000-0000-4000-8000-000000000104',
  internRole: '00000000-0000-4000-8000-000000000105',
  readOnlyRole: '00000000-0000-4000-8000-000000000106',
  laborChecklistTemplate: '00000000-0000-4000-8000-000000000401',
  laborChecklistIdentification: '00000000-0000-4000-8000-000000000402',
  laborChecklistRepresentation: '00000000-0000-4000-8000-000000000403',
  laborChecklistInitialEvidence: '00000000-0000-4000-8000-000000000404',
} as const;

const permissions = [
  ['organizations.read', 'Visualizar os dados da organização.'],
  ['organizations.manage', 'Gerenciar os dados e configurações da organização.'],
  ['users.read', 'Visualizar usuários da organização.'],
  ['users.manage', 'Convidar, atualizar e bloquear usuários da organização.'],
  ['roles.read', 'Visualizar papéis e permissões disponíveis.'],
  ['roles.manage', 'Gerenciar papéis e atribuições da organização.'],
  ['cases.read', 'Visualizar casos autorizados.'],
  ['cases.manage', 'Criar e atualizar casos autorizados.'],
  ['documents.read', 'Visualizar documentos autorizados.'],
  ['documents.manage', 'Enviar, classificar e atualizar documentos autorizados.'],
  ['tasks.read', 'Visualizar tarefas autorizadas.'],
  ['tasks.manage', 'Criar, atribuir e concluir tarefas autorizadas.'],
  ['audit.read', 'Visualizar a trilha de auditoria autorizada.'],
  ['cases.create', 'Criar casos na organização.'],
  ['cases.update', 'Atualizar casos autorizados.'],
  ['cases.delete', 'Excluir logicamente casos autorizados.'],
  ['documents.upload', 'Enviar documentos para casos autorizados.'],
  ['documents.update', 'Atualizar documentos autorizados.'],
  ['documents.delete', 'Excluir logicamente documentos autorizados.'],
  ['documents.export', 'Exportar documentos autorizados.'],
  ['knowledge.search', 'Pesquisar a memória autorizada da organização.'],
  ['confidential_cases.read', 'Visualizar casos confidenciais autorizados.'],
  ['persons.read', 'Visualizar pessoas autorizadas da organização.'],
  ['persons.manage', 'Cadastrar e atualizar pessoas autorizadas da organização.'],
] as const;

const documentTypes = [
  ['RG', 'RG', 'IDENTIFICACAO'],
  ['CPF', 'CPF', 'IDENTIFICACAO'],
  ['CNH', 'CNH', 'IDENTIFICACAO'],
  ['CTPS', 'CTPS', 'IDENTIFICACAO'],
  ['COMPROVANTE_RESIDENCIA', 'Comprovante de residência', 'CADASTRAL'],
  ['CONTRATO', 'Contrato', 'CONTRATUAL'],
  ['PROCURACAO', 'Procuração', 'PROCESSUAL'],
  ['PETICAO_INICIAL', 'Petição inicial', 'PROCESSUAL'],
  ['CONTESTACAO', 'Contestação', 'PROCESSUAL'],
  ['SENTENCA', 'Sentença', 'PROCESSUAL'],
  ['ACORDAO', 'Acórdão', 'PROCESSUAL'],
  ['EXTRATO_BANCARIO', 'Extrato bancário', 'FINANCEIRO'],
  ['NOTA_FISCAL', 'Nota fiscal', 'FINANCEIRO'],
  ['LAUDO_MEDICO', 'Laudo médico', 'SAUDE'],
  ['BOLETIM_OCORRENCIA', 'Boletim de ocorrência', 'PROBATORIO'],
  ['CONVERSA_WHATSAPP', 'Conversa de WhatsApp', 'COMUNICACAO'],
  ['EMAIL', 'E-mail', 'COMUNICACAO'],
  ['AUDIO', 'Áudio', 'MIDIA'],
  ['VIDEO', 'Vídeo', 'MIDIA'],
  ['FOTO', 'Foto', 'MIDIA'],
  ['OUTRO', 'Outro documento', 'OUTRO'],
] as const;

function loadRootEnvironment(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
  } catch (error: unknown) {
    if (!(
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === 'ENOENT'
    )) {
      throw error;
    }
  }
}

function requiredEnvironment(name: 'DATABASE_URL' | 'SEED_ADMIN_PASSWORD'): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required to run the database seed.`);
  }

  return value;
}

async function main(): Promise<void> {
  loadRootEnvironment();

  if (process.env.NODE_ENV === 'production') {
    throw new Error('The fictional development seed cannot run in production.');
  }

  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const seedAdminPassword = requiredEnvironment('SEED_ADMIN_PASSWORD');
  const passwordHash = await argon2.hash(seedAdminPassword, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const prisma = createPrismaClient(databaseUrl);

  try {
    await withTransaction(
      prisma,
      async (transaction) => {
        await transaction.organization.upsert({
          where: { id: IDS.organization },
          update: {
            legalName: 'Lex OS Escritório Jurídico Fictício Ltda.',
            tradeName: 'Lex OS Demonstração',
            documentNumber: '00000000000000',
            subscriptionPlan: 'DEMO',
            status: 'ACTIVE',
            deletedAt: null,
          },
          create: {
            id: IDS.organization,
            legalName: 'Lex OS Escritório Jurídico Fictício Ltda.',
            tradeName: 'Lex OS Demonstração',
            documentNumber: '00000000000000',
            subscriptionPlan: 'DEMO',
            status: 'ACTIVE',
            settings: { fixture: true, locale: 'pt-BR' },
          },
        });

        await transaction.user.upsert({
          where: { id: IDS.adminUser },
          update: {
            organizationId: IDS.organization,
            name: 'Administrador Fictício',
            email: 'admin@lexos.invalid',
            passwordHash,
            status: 'ACTIVE',
            deletedAt: null,
          },
          create: {
            id: IDS.adminUser,
            organizationId: IDS.organization,
            name: 'Administrador Fictício',
            email: 'admin@lexos.invalid',
            passwordHash,
            status: 'ACTIVE',
          },
        });

        const roles = [
          {
            id: IDS.adminRole,
            code: 'ADMIN',
            name: 'Administrador da organização',
            description: 'Acesso administrativo à organização de demonstração.',
          },
          {
            id: IDS.lawyerRole,
            code: 'LAWYER',
            name: 'Advogado',
            description: 'Acesso jurídico operacional aos casos autorizados.',
          },
          {
            id: IDS.assistantRole,
            code: 'ASSISTANT',
            name: 'Assistente jurídico',
            description: 'Acesso de apoio aos casos e documentos autorizados.',
          },
          {
            id: IDS.partnerRole,
            code: 'PARTNER',
            name: 'Sócio',
            description: 'Acesso de supervisão jurídica e auditoria autorizada.',
          },
          {
            id: IDS.internRole,
            code: 'INTERN',
            name: 'Estagiário',
            description: 'Acesso jurídico supervisionado e de leitura.',
          },
          {
            id: IDS.readOnlyRole,
            code: 'READ_ONLY',
            name: 'Somente leitura',
            description: 'Acesso somente de consulta aos recursos autorizados.',
          },
        ] as const;

        for (const role of roles) {
          await transaction.role.upsert({
            where: { id: role.id },
            update: {
              organizationId: null,
              code: role.code,
              name: role.name,
              description: role.description,
            },
            create: { ...role, organizationId: null },
          });
        }

        const permissionIdsByCode = new Map<string, string>();

        for (const [index, [code, description]] of permissions.entries()) {
          const id = `00000000-0000-4000-8000-${String(201 + index).padStart(12, '0')}`;
          const permission = await transaction.permission.upsert({
            where: { code },
            update: { description },
            create: { id, code, description },
          });
          permissionIdsByCode.set(code, permission.id);
        }

        const permissionBundles = [
          [IDS.adminRole, permissions.map(([code]) => code)],
          [
            IDS.partnerRole,
            [
              'organizations.read',
              'users.read',
              'roles.read',
              'persons.read',
              'persons.manage',
              'cases.read',
              'cases.create',
              'cases.update',
              'documents.read',
              'documents.upload',
              'documents.update',
              'documents.export',
              'tasks.read',
              'tasks.manage',
              'knowledge.search',
              'audit.read',
              'confidential_cases.read',
            ],
          ],
          [
            IDS.lawyerRole,
            [
              'organizations.read',
              'persons.read',
              'persons.manage',
              'cases.read',
              'cases.create',
              'cases.update',
              'documents.read',
              'documents.upload',
              'documents.update',
              'documents.export',
              'tasks.read',
              'tasks.manage',
              'knowledge.search',
              'confidential_cases.read',
            ],
          ],
          [
            IDS.assistantRole,
            [
              'organizations.read',
              'persons.read',
              'persons.manage',
              'cases.read',
              'cases.create',
              'cases.update',
              'documents.read',
              'documents.upload',
              'documents.update',
              'tasks.read',
              'tasks.manage',
              'knowledge.search',
            ],
          ],
          [
            IDS.internRole,
            [
              'organizations.read',
              'persons.read',
              'cases.read',
              'documents.read',
              'tasks.read',
              'knowledge.search',
            ],
          ],
          [
            IDS.readOnlyRole,
            [
              'organizations.read',
              'persons.read',
              'cases.read',
              'documents.read',
              'knowledge.search',
            ],
          ],
        ] as const;

        await transaction.rolePermission.deleteMany({
          where: { roleId: { in: roles.map((role) => role.id) } },
        });

        for (const [roleId, permissionCodes] of permissionBundles) {
          for (const permissionCode of permissionCodes) {
            const permissionId = permissionIdsByCode.get(permissionCode);

            if (permissionId === undefined) {
              throw new Error(`Missing seeded permission: ${permissionCode}`);
            }

            await transaction.rolePermission.create({ data: { roleId, permissionId } });
          }
        }

        await transaction.userRole.upsert({
          where: {
            userId_roleId: {
              userId: IDS.adminUser,
              roleId: IDS.adminRole,
            },
          },
          update: {},
          create: {
            userId: IDS.adminUser,
            roleId: IDS.adminRole,
          },
        });

        const documentTypeIdsByCode = new Map<string, string>();

        for (const [index, [code, name, category]] of documentTypes.entries()) {
          const id = `00000000-0000-4000-8000-${String(301 + index).padStart(12, '0')}`;

          await transaction.documentType.upsert({
            where: { id },
            update: {
              organizationId: null,
              code,
              name,
              category,
              isSystem: true,
            },
            create: {
              id,
              organizationId: null,
              code,
              name,
              category,
              description: `${name} — catálogo global fictício de demonstração.`,
              requiredFields: {},
              isSystem: true,
            },
          });
          documentTypeIdsByCode.set(code, id);
        }

        await transaction.checklistTemplate.upsert({
          where: { id: IDS.laborChecklistTemplate },
          update: {
            organizationId: null,
            name: 'Checklist trabalhista inicial',
            legalArea: 'TRABALHISTA',
            caseType: 'RECLAMACAO_TRABALHISTA',
            version: 1,
            isActive: true,
          },
          create: {
            id: IDS.laborChecklistTemplate,
            organizationId: null,
            name: 'Checklist trabalhista inicial',
            legalArea: 'TRABALHISTA',
            caseType: 'RECLAMACAO_TRABALHISTA',
            version: 1,
            isActive: true,
          },
        });

        const checklistItems = [
          {
            id: IDS.laborChecklistIdentification,
            documentTypeCode: 'RG',
            title: 'Documento de identificação',
            description: 'Documento fictício para identificação da parte atendida.',
            sortOrder: 1,
          },
          {
            id: IDS.laborChecklistRepresentation,
            documentTypeCode: 'PROCURACAO',
            title: 'Procuração',
            description: 'Instrumento de representação para a atuação jurídica.',
            sortOrder: 2,
          },
          {
            id: IDS.laborChecklistInitialEvidence,
            documentTypeCode: 'OUTRO',
            title: 'Documento inicial para análise',
            description: 'Material inicial fictício que fundamenta a triagem do caso.',
            sortOrder: 3,
          },
        ] as const;

        for (const item of checklistItems) {
          const documentTypeId = documentTypeIdsByCode.get(item.documentTypeCode);

          if (documentTypeId === undefined) {
            throw new Error(`Missing seeded document type: ${item.documentTypeCode}`);
          }

          await transaction.checklistTemplateItem.upsert({
            where: { id: item.id },
            update: {
              organizationId: null,
              templateId: IDS.laborChecklistTemplate,
              documentTypeId,
              title: item.title,
              description: item.description,
              isRequired: true,
              sortOrder: item.sortOrder,
            },
            create: {
              id: item.id,
              organizationId: null,
              templateId: IDS.laborChecklistTemplate,
              documentTypeId,
              title: item.title,
              description: item.description,
              isRequired: true,
              sortOrder: item.sortOrder,
            },
          });
        }

        await transaction.case.upsert({
          where: { id: IDS.demoCase },
          update: {
            organizationId: IDS.organization,
            internalCode: 'DEMO-0001',
            title: 'Caso trabalhista fictício de demonstração',
            description: 'Fixture sem pessoas, documentos ou fatos reais.',
            legalArea: 'TRABALHISTA',
            caseType: 'RECLAMACAO_TRABALHISTA',
            status: 'INTAKE',
            responsibleUserId: IDS.adminUser,
            deletedAt: null,
          },
          create: {
            id: IDS.demoCase,
            organizationId: IDS.organization,
            internalCode: 'DEMO-0001',
            title: 'Caso trabalhista fictício de demonstração',
            description: 'Fixture sem pessoas, documentos ou fatos reais.',
            legalArea: 'TRABALHISTA',
            caseType: 'RECLAMACAO_TRABALHISTA',
            status: 'INTAKE',
            responsibleUserId: IDS.adminUser,
          },
        });
      },
      { timeoutMs: 30_000 },
    );

    console.info(
      `Fictional seed complete: 1 organization, 1 admin, 6 roles, ${permissions.length} permissions, ${documentTypes.length} document types, 1 checklist template, and 1 demo case.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
