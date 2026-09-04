import type {
  CaseChecklistStatus,
  CaseStatus,
  ChecklistItemStatus,
  ConfidentialityLevel,
  DatePrecision,
  ExtractionType,
  Importance,
  ParticipantRole,
  ParticipantSide,
  PersonType,
  ProcessingJobType,
  Priority,
  TaskSourceType,
  TaskStatus,
  UserStatus,
} from '../api/types.js';
import { providerLabels } from '@lex-os/shared/legal-vocabulary';

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

export const personTypeLabels: Readonly<Record<PersonType, string>> = {
  INDIVIDUAL: 'Pessoa física',
  COMPANY: 'Pessoa jurídica',
  GOVERNMENT_ENTITY: 'Ente público',
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

/**
 * Etapa do preparo em verbo do dia a dia. O advogado acompanha "Extraindo texto",
 * nunca "OCR" ou "job": a etapa informa e tranquiliza sem exigir vocabulário técnico.
 */
export const stageLabels: Readonly<Record<ProcessingJobType, string>> = {
  FILE_VALIDATION: 'Validando',
  VIRUS_SCAN: 'Verificando segurança',
  OCR: 'Extraindo texto',
  TRANSCRIPTION: 'Transcrevendo',
  DOCUMENT_CLASSIFICATION: 'Classificando',
  ENTITY_EXTRACTION: 'Identificando dados',
  SUMMARY: 'Resumindo',
  EMBEDDING: 'Indexando',
  DUPLICATE_DETECTION: 'Verificando duplicidade',
  TIMELINE_GENERATION: 'Gerando cronologia',
  CHECKLIST_ANALYSIS: 'Analisando checklist',
};

export const extractionTypeLabels: Readonly<Record<ExtractionType, string>> = {
  OCR: 'Extração de texto',
  TRANSCRIPTION: 'Transcrição',
  CLASSIFICATION: 'Classificação',
  SUMMARY: 'Resumo',
  ENTITY_EXTRACTION: 'Identificação de dados',
  IMAGE_ANALYSIS: 'Análise de imagem',
  TIMELINE_ANALYSIS: 'Análise de cronologia',
  CHECKLIST_ANALYSIS: 'Análise de checklist',
};

/**
 * Tipos de entidade são texto livre do provedor, não um catálogo fechado da API. Os
 * conhecidos ganham nome próprio; o resto passa por humanizeCode para nunca vazar
 * MAIÚSCULA_COM_UNDERSCORE na tela.
 */
const knownEntityTypes: Readonly<Record<string, string>> = {
  CONTRACT_NUMBER: 'Número de contrato',
  CASE_NUMBER: 'Número do processo',
  DATE: 'Data',
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  RG: 'RG',
  OAB: 'OAB',
  PERSON_NAME: 'Nome de pessoa',
  COMPANY_NAME: 'Empresa',
  MONETARY_VALUE: 'Valor',
  AMOUNT: 'Valor',
  ADDRESS: 'Endereço',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
};

export function entityTypeLabel(entityType: string): string {
  return knownEntityTypes[entityType] ?? humanizeCode(entityType);
}

export function formatConfidence(score: number | null): string {
  return score === null ? '—' : `${Math.round(score * 100)}%`;
}

export const importanceLabels: Readonly<Record<Importance, string>> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

// Datas de fato jurídico formatam em UTC: o dia veio de um documento, não do relógio de
// quem lê. Sem isso, 14/03 vira 13/03 em qualquer fuso a oeste de Greenwich.
const eventDay = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthYear = new Intl.DateTimeFormat('pt-BR', {
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const yearOnly = new Intl.DateTimeFormat('pt-BR', { year: 'numeric', timeZone: 'UTC' });

/**
 * A data do evento respeita a precisão registrada: mostrar "14/03/2019" quando o documento
 * só sustenta "março de 2019" seria inventar certeza — exatamente o que o produto promete
 * não fazer.
 */
export function formatEventDate(iso: string | null, precision: DatePrecision): string {
  if (iso === null || precision === 'UNKNOWN') {
    return 'Data não identificada';
  }
  const date = new Date(iso);
  switch (precision) {
    case 'MONTH':
      return monthYear.format(date);
    case 'YEAR':
      return yearOnly.format(date);
    case 'APPROXIMATE':
      return `Por volta de ${eventDay.format(date)}`;
    default:
      return eventDay.format(date);
  }
}

/**
 * Tipos de evento são texto livre do provedor; nunca vazam em MAIÚSCULA_COM_UNDERSCORE.
 *
 * Os códigos são gravados em inglês, como toda identificação técnica do sistema, e até aqui a
 * tela só trocava o sublinhado por espaço — um advogado brasileiro lia "Contract date" na
 * cronologia do próprio caso. Os conhecidos ganham nome em português; o desconhecido continua
 * caindo no humanizador, porque provedor novo pode trazer um código que ninguém cadastrou e a
 * tela não pode quebrar por isso.
 */
const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  CONTRACT_DATE: 'Data do contrato',
  DATE_READ_FROM_DOCUMENT: 'Data lida do documento',
  DOCUMENT_DATE: 'Data do documento',
  HEARING: 'Audiência',
  DEADLINE: 'Prazo',
  FILING: 'Protocolo',
  DECISION: 'Decisão',
  PAYMENT: 'Pagamento',
  NOTIFICATION: 'Notificação',
  ADMISSION: 'Admissão',
  TERMINATION: 'Rescisão',
};

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? humanizeCode(eventType);
}

/**
 * Nome legível de quem executou a etapa.
 *
 * O mapa vive em `@lex-os/shared` porque a mesma palavra sai na tela e no dossiê em PDF, que é
 * montado pelo worker: mantê-lo aqui criaria a segunda cópia que o teste de deriva existe para
 * impedir. Provedor desconhecido cai no humanizador — modelo novo pode trazer identificador que
 * ninguém cadastrou, e a tela não pode quebrar por isso.
 */
/**
 * O que cada registro de auditoria significa, em português.
 *
 * Esta é a tela que um escritório abre para provar controle — a um cliente, a um sócio, a quem
 * audita. Ela listava `case.confidential.read` e `auth.refresh.succeeded`: identificador técnico,
 * em inglês, sobre a operação de um escritório brasileiro. Quem precisa responder "quem abriu
 * este caso sigiloso e quando" não deveria ter de traduzir o sistema antes.
 *
 * O código continua visível abaixo do rótulo e continua sendo o que o filtro aceita: ele é o
 * registro, e é por ele que se procura. O rótulo é o que se lê.
 */
const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  'assistant.answer.generated': 'Resposta do assistente gerada',
  'assistant.answer.refused': 'Assistente recusou responder',
  'audit.log.listed': 'Trilha de auditoria consultada',
  'auth.login.blocked': 'Entrada bloqueada',
  'auth.login.failed': 'Tentativa de entrada malsucedida',
  'auth.login.succeeded': 'Entrada realizada',
  'auth.logout.succeeded': 'Saída realizada',
  'auth.password.reset.completed': 'Redefinição de senha concluída',
  'auth.password.reset.requested': 'Redefinição de senha solicitada',
  'auth.refresh.replayed': 'Reuso de credencial de renovação detectado',
  'auth.refresh.revoked': 'Credencial de renovação revogada',
  'auth.refresh.succeeded': 'Sessão renovada',
  'auth.second_factor.activated': 'Segundo fator ativado',
  'auth.second_factor.disabled': 'Segundo fator desativado',
  'auth.second_factor.enrolled': 'Segundo fator cadastrado',
  'auth.second_factor.recovery_used': 'Código de recuperação usado',
  'auth.second_factor.rejected': 'Segundo fator recusado',
  'case.confidential.read': 'Caso sigiloso aberto',
  'case.created': 'Caso criado',
  'case.deleted': 'Caso excluído',
  'case.export.downloaded': 'Dossiê baixado',
  'case.export.generated': 'Dossiê gerado',
  'case.export.requested': 'Dossiê solicitado',
  'case.legal_hold.placed': 'Retenção obrigatória posta',
  'case.legal_hold.released': 'Retenção obrigatória retirada',
  'case.processing_budget.updated': 'Teto de custo do caso alterado',
  'case.updated': 'Caso alterado',
  'case_participant.created': 'Parte vinculada ao caso',
  'checklist.analysis.completed': 'Análise do checklist concluída',
  'checklist.applied': 'Checklist aplicado ao caso',
  'checklist_item.updated': 'Exigência do checklist atualizada',
  'document.deleted': 'Documento excluído',
  'document.reprocessed': 'Documento reprocessado',
  'document.updated': 'Documento alterado',
  'extracted_entity.confirmed': 'Dado extraído confirmado',
  'file.download_url.created': 'Link de download emitido',
  'file.duplicate.detected': 'Arquivo duplicado identificado',
  'file.upload.quarantined': 'Arquivo enviado para quarentena',
  'file.upload.rejected': 'Envio de arquivo recusado',
  'file.uploaded': 'Arquivo enviado',
  'knowledge.document.indexed': 'Documento indexado para busca',
  'knowledge.search.executed': 'Busca no acervo executada',
  'person.created': 'Pessoa cadastrada',
  'person.deleted': 'Pessoa excluída',
  'person.updated': 'Pessoa alterada',
  'processing.budget.limit_reached': 'Teto de custo atingido',
  'processing.cost.summarised': 'Custo de preparo consultado',
  'processing.extraction.created': 'Extração registrada',
  'processing.job.cancelled': 'Preparo cancelado',
  'processing.job.completed': 'Preparo concluído',
  'task.created': 'Tarefa criada',
  'task.updated': 'Tarefa atualizada',
  'timeline.event.confirmed': 'Evento da cronologia confirmado',
  'timeline.event.created': 'Evento da cronologia registrado',
  'user.assignable.listed': 'Responsáveis disponíveis consultados',
  'user.blocked': 'Pessoa da equipe bloqueada',
  'user.invitation.accepted': 'Convite aceito',
  'user.invitation.revoked': 'Convite revogado',
  'user.invited': 'Convite enviado',
  'user.listed': 'Equipe consultada',
  'user.notifications.updated': 'Preferências de notificação alteradas',
  'user.reactivated': 'Pessoa da equipe reativada',
  'user.roles.replaced': 'Papéis da pessoa alterados',
};

/** Ação sem rótulo aparece pelo código: é o sinal de que o mapa ficou para trás. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function providerLabel(provider: string): string {
  // O humanizador comum troca sublinhado, que é a forma dos códigos de domínio. Identificador de
  // provedor é separado por hífen, e sem tratá-lo o desconhecido saía "Provedor-novo-sem-rotulo".
  return providerLabels[provider] ?? humanizeCode(provider.replace(/-/gu, '_'));
}

/**
 * Situação de cada exigência do checklist. O vocabulário é o do escritório: "Não recebido"
 * em vez de MISSING, porque a pergunta que o advogado faz é "o que falta para protocolar".
 */
export const checklistItemStatusLabels: Readonly<Record<ChecklistItemStatus, string>> = {
  MISSING: 'Não recebido',
  RECEIVED: 'Recebido',
  INVALID: 'Inválido',
  EXPIRED: 'Vencido',
  ILLEGIBLE: 'Ilegível',
  AWAITING_VALIDATION: 'Aguardando validação',
  VALIDATED: 'Validado',
  NOT_APPLICABLE: 'Não se aplica',
};

export const caseChecklistStatusLabels: Readonly<Record<CaseChecklistStatus, string>> = {
  IN_PROGRESS: 'Em andamento',
  NEEDS_REVIEW: 'Precisa de revisão',
  COMPLETED: 'Concluído',
};

/**
 * O tom separa o que impede o protocolo do que já está resolvido. Pendência obrigatória é
 * o único caso vermelho: é ela que trava a peça.
 */
export function checklistItemTone(
  status: ChecklistItemStatus,
  isRequired: boolean,
): 'neutro' | 'pendente' | 'confirmado' | 'rejeitado' {
  switch (status) {
    case 'VALIDATED':
      return 'confirmado';
    case 'RECEIVED':
    case 'AWAITING_VALIDATION':
      return 'pendente';
    case 'NOT_APPLICABLE':
      return 'neutro';
    // Ilegível, inválido e vencido são o mesmo tipo de notícia que "não recebido": a exigência
    // não está satisfeita e alguém precisa agir. Caíam no default e saíam com a cor de neutro,
    // que na tela lê como resolvido.
    case 'MISSING':
    case 'ILLEGIBLE':
    case 'INVALID':
    case 'EXPIRED':
      return isRequired ? 'rejeitado' : 'pendente';
    default:
      return 'rejeitado';
  }
}

export const taskStatusLabels: Readonly<Record<TaskStatus, string>> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

/**
 * A origem da tarefa é rastreabilidade, não decoração: quem abriu a tarefa importa quando
 * alguém pergunta por que ela existe. Tarefa vinda do checklist aponta para a exigência.
 */
export const taskSourceLabels: Readonly<Record<TaskSourceType, string>> = {
  USER: 'Criada por pessoa',
  AI_CHECKLIST: 'Origem no checklist',
  AI_DOCUMENT_ANALYSIS: 'Origem na análise do documento',
  COURT_MOVEMENT: 'Origem em movimentação',
  WORKFLOW: 'Origem em fluxo automático',
};

export function taskStatusTone(
  status: TaskStatus,
): 'neutro' | 'pendente' | 'confirmado' | 'rejeitado' {
  switch (status) {
    case 'COMPLETED':
      return 'confirmado';
    case 'IN_PROGRESS':
      return 'pendente';
    case 'CANCELLED':
      return 'neutro';
    default:
      return 'pendente';
  }
}

/**
 * Prazo em linguagem de quem tem prazo processual: o atraso é dito com todas as letras,
 * e "hoje" e "amanhã" valem mais que a data crua.
 */
export function formatDueDate(iso: string | null, now: Date = new Date()): string | null {
  if (iso === null) {
    return null;
  }
  const due = new Date(iso);
  const startOfDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);

  if (days < 0) {
    const late = Math.abs(days);
    return `Atrasada ${late} ${late === 1 ? 'dia' : 'dias'}`;
  }
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanhã';
  return `Vence em ${days} dias`;
}

export function isOverdue(iso: string | null, status: TaskStatus, now: Date = new Date()): boolean {
  if (iso === null || status === 'COMPLETED' || status === 'CANCELLED') {
    return false;
  }
  return new Date(iso).getTime() < now.getTime();
}

/**
 * Situação de acesso da pessoa. "Convidada" é estado real e visível: ela existe no
 * escritório, aparece na lista, e ainda não entrou uma vez sequer.
 */
export const userStatusLabels: Readonly<Record<UserStatus, string>> = {
  INVITED: 'Convidada',
  ACTIVE: 'Ativa',
  BLOCKED: 'Bloqueada',
  INACTIVE: 'Desligada',
};

export function userStatusTone(
  status: UserStatus,
): 'neutro' | 'pendente' | 'confirmado' | 'rejeitado' {
  switch (status) {
    case 'ACTIVE':
      return 'confirmado';
    case 'INVITED':
      return 'pendente';
    case 'BLOCKED':
      return 'rejeitado';
    default:
      return 'neutro';
  }
}

/** Último acesso em linguagem de quem confere acesso, não em data crua. */
export function formatLastLogin(iso: string | null): string {
  if (iso === null) {
    return 'Nunca entrou';
  }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Entrou hoje';
  if (days === 1) return 'Entrou ontem';
  if (days < 30) return `Há ${days} dias`;
  return formatDate(iso);
}
