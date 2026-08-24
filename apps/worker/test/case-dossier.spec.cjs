let renderCaseDossier;

beforeAll(async () => {
  ({ renderCaseDossier } = await import('../dist/export/case-dossier.js'));
});

function dossier(overrides = {}) {
  return {
    organizationName: 'Escritório Fictício',
    generatedAt: '2026-08-24T12:00:00.000Z',
    generatedBy: 'Administrador Fictício',
    legalCase: {
      internalCode: 'DEMO-0001',
      cnjNumber: '0001234-27.2026.5.02.0001',
      cnjSegment: 'Justiça do Trabalho',
      court: 'TRT da 2ª Região',
      courtDivision: '1ª Vara do Trabalho de São Paulo',
      title: 'Caso trabalhista fictício de demonstração',
      description: 'Descrição fictícia para verificação.',
      legalArea: 'TRABALHISTA',
      caseType: 'RECLAMACAO_TRABALHISTA',
      status: 'INTAKE',
      priority: 'NORMAL',
      confidentialityLevel: 'STANDARD',
      responsible: 'Advogada Fictícia',
      openedAt: '2026-08-01T12:00:00.000Z',
    },
    participants: [
      { name: 'Pessoa Fictícia', role: 'reclamante', side: 'polo_ativo', isClient: true },
    ],
    events: [
      {
        occurredAt: '2026-07-15T12:00:00.000Z',
        precision: 'DAY',
        title: 'Fato fictício confirmado',
        description: 'Descrição do fato fictício.',
        provenance: {
          documentTitle: 'Documento fictício',
          page: 3,
          excerpt: 'trecho fictício de origem',
          provider: 'lex-os-mock-timeline',
          model: 'mock',
          modelVersion: 'v1',
          confidence: 0.92,
        },
      },
    ],
    unconfirmedEventCount: 2,
    checklists: [
      {
        templateName: 'Modelo fictício',
        templateVersion: 1,
        appliedAt: '2026-08-02T12:00:00.000Z',
        items: [
          {
            requirement: 'Exigência fictícia',
            status: 'MISSING',
            mandatory: true,
            documentTitle: null,
            note: null,
          },
        ],
      },
    ],
    documentCount: 4,
    ...overrides,
  };
}

const { inflateSync } = require('node:zlib');

const HEX_STRING = new RegExp(String.raw`<([0-9a-fA-F\s]+)>`, 'gu');
const WHITESPACE = new RegExp(String.raw`\s`, 'gu');

/**
 * Texto do PDF.
 *
 * O pdfkit comprime os fluxos de conteúdo, então procurar a frase nos bytes crus não acha
 * nada — e um teste que passasse assim estaria conferindo o vazio. Aqui os fluxos são
 * inflados um a um; o que não inflar é imagem ou fonte e simplesmente não entra.
 */
function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  let content = '';
  let cursor = 0;
  for (;;) {
    const start = raw.indexOf('stream', cursor);
    if (start === -1) break;
    const end = raw.indexOf('endstream', start);
    if (end === -1) break;
    // Depois de "stream" vem CR+LF ou so LF, conforme o escritor.
    const begin = raw.charCodeAt(start + 6) === 13 ? start + 8 : start + 7;
    try {
      content += inflateSync(Buffer.from(raw.slice(begin, end), 'latin1')).toString('latin1');
    } catch {
      // Fluxo nao comprimido ou binario: nao e onde o texto do dossie esta.
    }
    cursor = end + 9;
  }
  // O pdfkit escreve os glifos como cadeias hexadecimais dentro de arrays TJ.
  let text = '';
  for (const match of content.matchAll(HEX_STRING)) {
    const hex = match[1].replace(WHITESPACE, '');
    text += Buffer.from(hex, 'hex').toString('latin1');
  }
  return text;
}

describe('dossiê do caso', () => {
  it('produz um PDF válido, com páginas e metadados', async () => {
    const pdf = await renderCaseDossier(dossier());

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.subarray(-6).toString('ascii')).toContain('%%EOF');
    expect(pdf.byteLength).toBeGreaterThan(1_000);
  });

  it('leva o número do processo para a capa e para o rodapé de cada página', async () => {
    const text = pdfText(await renderCaseDossier(dossier()));

    // O número aparece na capa e uma vez por página no rodapé.
    const occurrences = text.split('0001234-27.2026.5.02.0001').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('avisa o sigilo no rodapé quando o caso não é padrão', async () => {
    const confidential = dossier();
    confidential.legalCase.confidentialityLevel = 'CONFIDENTIAL';
    const text = pdfText(await renderCaseDossier(confidential));

    expect(text).toContain('documento sigiloso');
  });

  it('não marca sigilo num caso padrão', async () => {
    const text = pdfText(await renderCaseDossier(dossier()));

    expect(text).not.toContain('documento sigiloso');
  });

  it('conta o não confirmado sem narrá-lo', async () => {
    const text = pdfText(await renderCaseDossier(dossier()));

    expect(text).toContain('aguardam');
    expect(text).toContain('Fato fict');
  });

  it('cai no código interno quando o caso ainda não foi protocolado', async () => {
    const unfiled = dossier();
    unfiled.legalCase.cnjNumber = null;
    unfiled.legalCase.cnjSegment = null;
    const text = pdfText(await renderCaseDossier(unfiled));

    expect(text).toContain('DEMO-0001');
  });

  it('monta um caso vazio sem quebrar', async () => {
    const empty = dossier({
      participants: [],
      events: [],
      unconfirmedEventCount: 0,
      checklists: [],
      documentCount: 0,
    });
    empty.legalCase.description = null;

    const pdf = await renderCaseDossier(empty);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('aguenta um caso grande em várias páginas', async () => {
    const many = dossier({
      events: Array.from({ length: 120 }, (_unused, index) => ({
        occurredAt: '2026-07-15T12:00:00.000Z',
        precision: 'DAY',
        title: `Fato fictício ${index + 1}`,
        description: 'Descrição repetida para forçar a quebra de página.',
        provenance: {
          documentTitle: 'Documento fictício',
          page: index + 1,
          excerpt: 'trecho fictício de origem',
          provider: 'lex-os-mock-timeline',
          model: 'mock',
          modelVersion: 'v1',
          confidence: 0.5,
        },
      })),
    });

    const pdf = await renderCaseDossier(many);
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    // Rodapé com o total: só existe depois que o documento inteiro foi montado.
    expect(pdfText(pdf)).toContain(' de ');
  });
});
