import type { CaseStatus, ConfidentialityLevel, Priority } from '../api/types.js';

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
