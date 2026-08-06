import type {
  CaseStatus,
  ConfidentialityLevel,
  ParticipantRole,
  ParticipantSide,
  Priority,
} from '../api/types.js';

/**
 * Tradução dos códigos da API para o vocabulário do usuário.
 *
 * Nenhum rótulo técnico chega à tela: `READY_TO_FILE` é um detalhe do banco,
 * "Pronto para protocolo" é o que o advogado lê. Ver design-principles.md.
 */

export const caseStatusLabels: Readonly<Record<CaseStatus, string>> = {
  INTAKE: 'Em recebimento',
  DOCUMENT_COLLECTION: 'Coletando documentos',
  UNDER_ANALYSIS: 'Em análise',
  READY_TO_FILE: 'Pronto para protocolo',
  FILED: 'Protocolado',
  ACTIVE: 'Em andamento',
  SUSPENDED: 'Suspenso',
  SETTLED: 'Acordo firmado',
  CLOSED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

export const priorityLabels: Readonly<Record<Priority, string>> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const confidentialityLabels: Readonly<Record<ConfidentialityLevel, string>> = {
  STANDARD: 'Padrão',
  CONFIDENTIAL: 'Confidencial',
  RESTRICTED: 'Restrito',
};

/**
 * Área e tipo chegam como texto livre em maiúsculas com underscore. Não há catálogo fechado
 * na API, então a apresentação normaliza sem inventar tradução.
 */
export function humanizeCode(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeWithClock = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeWithClock.format(new Date(iso));
}

export const participantRoleLabels: Readonly<Record<ParticipantRole, string>> = {
  autor: 'Autor',
  reu: 'Réu',
  reclamante: 'Reclamante',
  reclamado: 'Reclamado',
  testemunha: 'Testemunha',
  perito: 'Perito',
  juiz: 'Juiz',
  advogado: 'Advogado',
  terceiro_interessado: 'Terceiro interessado',
  representante_legal: 'Representante legal',
};

export const participantSideLabels: Readonly<Record<ParticipantSide, string>> = {
  polo_ativo: 'Polo ativo',
  polo_passivo: 'Polo passivo',
  terceiro: 'Terceiro',
  neutro: 'Neutro',
};

/**
 * Situação do documento como o usuário entende. O processamento e a classificação são dois
 * eixos na API; na tela vira uma frase só, porque o advogado quer saber se pode revisar.
 */
export function documentSituation(document: {
  processingStatus: string;
  classificationStatus: string;
  isDuplicate: boolean;
}): { label: string; tone: 'neutro' | 'pendente' | 'confirmado' | 'rejeitado' } {
  if (document.isDuplicate) {
    return { label: 'Duplicado', tone: 'neutro' };
  }
  switch (document.processingStatus) {
    case 'QUEUED':
      return { label: 'Na fila', tone: 'neutro' };
    case 'PROCESSING':
      return { label: 'Preparando', tone: 'pendente' };
    case 'FAILED':
      return { label: 'Falhou', tone: 'rejeitado' };
    case 'NEEDS_REVIEW':
      return { label: 'Aguardando revisão', tone: 'pendente' };
    case 'COMPLETED':
      return document.classificationStatus === 'CONFIRMED'
        ? { label: 'Revisado', tone: 'confirmado' }
        : { label: 'Aguardando revisão', tone: 'pendente' };
    default:
      return { label: 'Em preparação', tone: 'neutro' };
  }
}

const byteUnits = ['B', 'KB', 'MB', 'GB'];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? value : Number(value.toFixed(value < 10 ? 1 : 0));
  return `${rounded.toLocaleString('pt-BR')} ${byteUnits[unit]}`;
}
