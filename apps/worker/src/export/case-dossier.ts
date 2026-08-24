import PDFDocument from 'pdfkit';

/**
 * O dossiê do caso em PDF.
 *
 * Este é o documento que sai do sistema e chega ao cliente por e-mail, muitas vezes antes de
 * qualquer pessoa da banca ter aberto o LEX OS. Ele carrega o que nos diferencia: cada dado
 * que a inteligência identificou aponta para o arquivo, a página e o trecho de onde saiu.
 *
 * Duas regras governam o conteúdo, e nenhuma é estética:
 *
 * 1. **Nada não confirmado entra como fato.** A cronologia traz apenas eventos confirmados por
 *    uma pessoa. Os demais são contados, não narrados — um documento assinado por advogado não
 *    pode misturar o que foi verificado com o que o modelo achou.
 * 2. **Todo dado extraído mostra a origem.** Sem arquivo, página e trecho, o dado vale nada
 *    numa discussão, e o dossiê deixaria de ser prova do nosso próprio argumento.
 *
 * O desenho é o mesmo da interface, traduzido para papel: régua tipográfica curta, filete no
 * lugar de caixa, e nada de cor decorativa. Um documento que chega à mesa de um sócio compete
 * com peças impressas em gráfica, não com relatório de painel administrativo.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;

/* A tinta é quase preta, e o cinza tem um viés de azul para conversar com a marca. */
const INK = '#12191f';
const INK_SOFT = '#5b6a75';
const RULE = '#c8d2d9';
const ACCENT = '#0b4e8f';

export interface DossierProvenance {
  documentTitle: string;
  page: number | null;
  excerpt: string | null;
  provider: string | null;
  model: string | null;
  modelVersion: string | null;
  confidence: number | null;
}

export interface DossierEvent {
  occurredAt: string;
  precision: string;
  title: string;
  description: string | null;
  provenance: DossierProvenance | null;
}

export interface DossierChecklistItem {
  requirement: string;
  status: string;
  mandatory: boolean;
  documentTitle: string | null;
  note: string | null;
}

export interface DossierChecklist {
  templateName: string;
  templateVersion: number;
  appliedAt: string;
  items: DossierChecklistItem[];
}

export interface DossierParticipant {
  name: string;
  role: string;
  side: string | null;
  isClient: boolean;
}

export interface DossierInput {
  organizationName: string;
  generatedAt: string;
  generatedBy: string;
  legalCase: {
    internalCode: string;
    cnjNumber: string | null;
    cnjSegment: string | null;
    court: string | null;
    courtDivision: string | null;
    title: string;
    description: string | null;
    legalArea: string;
    caseType: string;
    status: string;
    priority: string;
    confidentialityLevel: string;
    responsible: string | null;
    openedAt: string;
  };
  participants: DossierParticipant[];
  events: DossierEvent[];
  /** Eventos que a inteligência propôs e ninguém confirmou. Contados, nunca narrados. */
  unconfirmedEventCount: number;
  checklists: DossierChecklist[];
  documentCount: number;
}

const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });
const dateAndTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/**
 * A data respeita a precisão registrada.
 *
 * Um fato que os autos datam apenas por mês não pode virar um dia exato no dossiê: inventar
 * precisão é o tipo de erro que só aparece quando a outra parte aponta.
 */
function eventDate(iso: string, precision: string): string {
  const date = new Date(iso);
  if (precision === 'YEAR') return String(date.getUTCFullYear());
  if (precision === 'MONTH') {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
  if (precision === 'DATETIME') return dateAndTime.format(date);
  return dateOnly.format(date);
}

function confidenceLabel(value: number | null): string | null {
  if (value === null) return null;
  return `confiança ${Math.round(value * 100)}%`;
}

type Doc = InstanceType<typeof PDFDocument>;

function rule(doc: Doc, color = RULE): void {
  const y = doc.y;
  doc
    .save()
    .lineWidth(0.6)
    .strokeColor(color)
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .stroke()
    .restore();
  doc.y = y + 1;
}

function eyebrow(doc: Doc, text: string): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(INK_SOFT)
    .text(text.toUpperCase(), MARGIN, doc.y, { width: CONTENT_WIDTH, characterSpacing: 1.1 });
  doc.moveDown(0.35);
}

/** Título de seção sempre com folga acima; a quebra de página vem antes da linha órfã. */
function section(doc: Doc, title: string): void {
  if (doc.y > A4[1] - MARGIN - 120) {
    doc.addPage();
  }
  doc.moveDown(1.2);
  rule(doc, ACCENT);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(title, MARGIN, doc.y);
  doc.moveDown(0.6);
}

function body(doc: Doc, text: string, options: { indent?: number; soft?: boolean } = {}): void {
  const indent = options.indent ?? 0;
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(options.soft === true ? INK_SOFT : INK)
    .text(text, MARGIN + indent, doc.y, { width: CONTENT_WIDTH - indent, lineGap: 2.2 });
}

function labelled(doc: Doc, label: string, value: string): void {
  const startY = doc.y;
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(INK_SOFT)
    .text(label.toUpperCase(), MARGIN, startY, { width: 130, characterSpacing: 0.8 });
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(INK)
    .text(value, MARGIN + 140, startY, { width: CONTENT_WIDTH - 140, lineGap: 2 });
  doc.moveDown(0.45);
}

/** A procedência em corpo menor e recuada: acompanha o fato sem competir com ele. */
function provenance(doc: Doc, source: DossierProvenance): void {
  const origin = [source.documentTitle, source.page === null ? null : `página ${source.page}`]
    .filter((part): part is string => part !== null)
    .join(', ');
  const technical = [
    source.provider,
    [source.model, source.modelVersion].filter(Boolean).join(' '),
    confidenceLabel(source.confidence),
  ]
    .filter((part) => part !== null && part !== '')
    .join(' · ');

  doc.moveDown(0.25);
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(INK_SOFT)
    .text(`Origem: ${origin}`, MARGIN + 18, doc.y, { width: CONTENT_WIDTH - 18, lineGap: 1.6 });
  if (source.excerpt !== null && source.excerpt.trim() !== '') {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(INK_SOFT)
      .text(`“${source.excerpt.trim()}”`, MARGIN + 18, doc.y, {
        width: CONTENT_WIDTH - 18,
        lineGap: 1.6,
      });
  }
  if (technical !== '') {
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text(technical, MARGIN + 18, doc.y, { width: CONTENT_WIDTH - 18 });
  }
}

function cover(doc: Doc, input: DossierInput): void {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK_SOFT);
  doc.text(input.organizationName.toUpperCase(), MARGIN, MARGIN, {
    width: CONTENT_WIDTH,
    characterSpacing: 1.2,
  });

  doc.moveDown(4);
  eyebrow(doc, 'Dossiê do caso');

  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor(INK)
    .text(input.legalCase.title, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 3 });

  doc.moveDown(0.8);
  if (input.legalCase.cnjNumber !== null) {
    doc
      .font('Courier')
      .fontSize(12)
      .fillColor(ACCENT)
      .text(input.legalCase.cnjNumber, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.3);
  }

  const forum = [input.legalCase.court, input.legalCase.courtDivision]
    .filter((part): part is string => part !== null)
    .join(' · ');
  if (forum !== '') {
    body(doc, forum, { soft: true });
  }

  doc.moveDown(2);
  rule(doc);
  doc.moveDown(0.8);

  labelled(doc, 'Código interno', input.legalCase.internalCode);
  if (input.legalCase.cnjSegment !== null) {
    labelled(doc, 'Segmento', input.legalCase.cnjSegment);
  }
  labelled(doc, 'Situação', input.legalCase.status);
  labelled(doc, 'Prioridade', input.legalCase.priority);
  labelled(doc, 'Responsável', input.legalCase.responsible ?? 'Sem responsável designado');
  labelled(doc, 'Aberto em', dateOnly.format(new Date(input.legalCase.openedAt)));
  labelled(doc, 'Documentos', String(input.documentCount));

  doc.moveDown(1.5);
  rule(doc);
  doc.moveDown(0.6);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK_SOFT)
    .text(
      `Emitido em ${dateAndTime.format(new Date(input.generatedAt))} (UTC) por ${input.generatedBy}. ` +
        'Documento gerado a partir do acervo do escritório. A cronologia reúne apenas fatos ' +
        'confirmados por uma pessoa; cada dado identificado por inteligência artificial indica ' +
        'o arquivo, a página e o trecho de origem.',
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH, lineGap: 2 },
    );
}

function participantsSection(doc: Doc, input: DossierInput): void {
  section(doc, 'Partes');
  if (input.participants.length === 0) {
    body(doc, 'Nenhuma parte registrada até a emissão deste dossiê.', { soft: true });
    return;
  }
  for (const participant of input.participants) {
    const marks = [participant.role, participant.side, participant.isClient ? 'cliente' : null]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ');
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(participant.name, MARGIN, doc.y, {
      width: CONTENT_WIDTH,
    });
    body(doc, marks, { soft: true });
    doc.moveDown(0.5);
  }
}

function timelineSection(doc: Doc, input: DossierInput): void {
  section(doc, 'Cronologia dos fatos');
  if (input.events.length === 0) {
    body(doc, 'Nenhum fato confirmado até a emissão deste dossiê.', { soft: true });
  }
  for (const event of input.events) {
    if (doc.y > A4[1] - MARGIN - 90) {
      doc.addPage();
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(ACCENT)
      .text(eventDate(event.occurredAt, event.precision), MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        characterSpacing: 0.4,
      });
    doc.moveDown(0.2);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(event.title, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
    if (event.description !== null && event.description.trim() !== '') {
      doc.moveDown(0.2);
      body(doc, event.description.trim());
    }
    if (event.provenance !== null) {
      provenance(doc, event.provenance);
    }
    doc.moveDown(0.9);
  }
  if (input.unconfirmedEventCount > 0) {
    doc.moveDown(0.3);
    body(
      doc,
      `${input.unconfirmedEventCount} ${
        input.unconfirmedEventCount === 1
          ? 'fato identificado aguarda confirmação e não integra esta cronologia.'
          : 'fatos identificados aguardam confirmação e não integram esta cronologia.'
      }`,
      { soft: true },
    );
  }
}

function checklistSection(doc: Doc, input: DossierInput): void {
  section(doc, 'Checklist documental');
  if (input.checklists.length === 0) {
    body(doc, 'Nenhum checklist aplicado a este caso.', { soft: true });
    return;
  }
  for (const checklist of input.checklists) {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(`${checklist.templateName} · versão ${checklist.templateVersion}`, MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    body(doc, `Aplicado em ${dateOnly.format(new Date(checklist.appliedAt))}`, { soft: true });
    doc.moveDown(0.5);

    for (const item of checklist.items) {
      if (doc.y > A4[1] - MARGIN - 70) {
        doc.addPage();
      }
      const marks = [
        item.status,
        item.mandatory ? 'obrigatório' : 'facultativo',
        item.documentTitle,
      ]
        .filter((part): part is string => part !== null && part !== '')
        .join(' · ');
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(INK)
        .text(item.requirement, MARGIN + 12, doc.y, { width: CONTENT_WIDTH - 12, lineGap: 2 });
      body(doc, marks, { indent: 12, soft: true });
      if (item.note !== null && item.note.trim() !== '') {
        body(doc, item.note.trim(), { indent: 12, soft: true });
      }
      doc.moveDown(0.5);
    }
    doc.moveDown(0.6);
  }
}

/**
 * Rodapé em todas as páginas, aplicado no fim.
 *
 * "Página X de Y" só existe depois que Y existe; escrever durante a montagem obrigaria a
 * adivinhar o total ou a gerar o documento duas vezes.
 */
function footers(doc: Doc, input: DossierInput): void {
  const pages = doc.bufferedPageRange();
  const identifier = input.legalCase.cnjNumber ?? input.legalCase.internalCode;
  const restricted = input.legalCase.confidentialityLevel !== 'STANDARD';

  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(pages.start + index);
    const y = A4[1] - MARGIN + 16;
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(RULE)
      .moveTo(MARGIN, y - 8)
      .lineTo(MARGIN + CONTENT_WIDTH, y - 8)
      .stroke()
      .restore();
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text(restricted ? `${identifier} · documento sigiloso` : identifier, MARGIN, y, {
        width: CONTENT_WIDTH / 2,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text(`${index + 1} de ${pages.count}`, MARGIN + CONTENT_WIDTH / 2, y, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
        lineBreak: false,
      });
  }
}

export function renderCaseDossier(input: DossierInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: A4,
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `Dossiê — ${input.legalCase.title}`,
        Author: input.organizationName,
        Subject: input.legalCase.cnjNumber ?? input.legalCase.internalCode,
        Creator: 'LEX OS',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    try {
      cover(doc, input);
      if (input.legalCase.description !== null && input.legalCase.description.trim() !== '') {
        section(doc, 'Resumo');
        body(doc, input.legalCase.description.trim());
      }
      participantsSection(doc, input);
      timelineSection(doc, input);
      checklistSection(doc, input);
      footers(doc, input);
      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Falha ao montar o dossiê.'));
    }
  });
}
