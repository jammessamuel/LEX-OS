/**
 * Como o produto fala com o advogado.
 *
 * Os códigos técnicos são do banco; estas são as palavras que a pessoa lê. Vivem aqui porque
 * a tela e o dossiê exportado descrevem **o mesmo caso**: se divergirem, o cliente recebe um
 * PDF dizendo uma coisa e o escritório vê outra na tela, e a diferença aparece justamente na
 * reunião em que alguém compara os dois.
 *
 * A escolha de palavra é deliberada em alguns pontos. Um item de checklist ausente é
 * "Não recebido", e não "Faltando": a pergunta que o advogado faz é o que ainda não chegou
 * às mãos dele, não o que o sistema não encontrou.
 */

export const caseStatusLabels: Readonly<Record<string, string>> = {
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

export const priorityLabels: Readonly<Record<string, string>> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const confidentialityLabels: Readonly<Record<string, string>> = {
  STANDARD: 'Padrão',
  CONFIDENTIAL: 'Confidencial',
  RESTRICTED: 'Restrito',
};

export const participantRoleLabels: Readonly<Record<string, string>> = {
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

export const participantSideLabels: Readonly<Record<string, string>> = {
  polo_ativo: 'Polo ativo',
  polo_passivo: 'Polo passivo',
  terceiro: 'Terceiro',
  neutro: 'Neutro',
};

export const checklistItemStatusLabels: Readonly<Record<string, string>> = {
  MISSING: 'Não recebido',
  RECEIVED: 'Recebido',
  INVALID: 'Inválido',
  EXPIRED: 'Vencido',
  ILLEGIBLE: 'Ilegível',
  AWAITING_VALIDATION: 'Aguardando validação',
  VALIDATED: 'Validado',
  NOT_APPLICABLE: 'Não se aplica',
};

/**
 * Nome legível de um código, ou o próprio código quando ele não estiver no mapa.
 *
 * Devolver o código cru é feio, mas é honesto: some do documento a informação, e não o
 * código, seria pior. Um valor desconhecido aqui significa que o mapa ficou para trás de uma
 * migração, e ele precisa aparecer para alguém notar.
 */
export function labelFor(map: Readonly<Record<string, string>>, code: string): string {
  return map[code] ?? code;
}
