/**
 * Contrato de envio de e-mail.
 *
 * Fica aqui, e não em um app, porque a API decide *que* mensagem existe e o worker é quem
 * entrega — os dois precisam do mesmo tipo sem que nenhum importe SDK de fornecedor. Nenhum
 * código de domínio conhece SMTP: só o adaptador de infraestrutura conhece.
 *
 * As mensagens são um catálogo fechado, não texto livre. Um `templateId` com dados nomeados
 * impede que conteúdo jurídico entre num e-mail por descuido: para mandar algo novo é preciso
 * escrever um modelo, e escrever um modelo é uma decisão revisável.
 */

export const emailTemplates = [
  'invitation',
  'password-reset',
  'document-failed',
  'task-assigned',
  'preparation-digest',
] as const;
export type EmailTemplateId = (typeof emailTemplates)[number];

/**
 * Os avisos que o escritório recebe, e quais dá para silenciar (ADR-013).
 *
 * `document-failed` não está na lista de silenciáveis, e a ausência é a regra: ignorar uma
 * falha de documento custa prazo processual, então ela é o único aviso que não se desliga.
 * Isso não é conferido em tempo de execução — o código do gatilho de falha simplesmente não
 * consulta preferência nenhuma, que é uma garantia mais forte que uma checagem.
 */
export const silenceableNotifications = ['task-assigned', 'preparation-digest'] as const;
export type SilenceableNotification = (typeof silenceableNotifications)[number];

export function isSilenceableNotification(value: string): value is SilenceableNotification {
  return (silenceableNotifications as readonly string[]).includes(value);
}

export interface EmailRecipient {
  /** Identificador da pessoa, para auditar o envio sem guardar o endereço. */
  userId: string;
  address: string;
  name: string;
}

export interface EmailMessage {
  templateId: EmailTemplateId;
  recipient: EmailRecipient;
  /**
   * Dados do modelo. Só o que o modelo consome, e nunca conteúdo de documento nem dado de
   * cliente: os modelos atuais carregam nome do escritório, nome da pessoa, um link e um
   * prazo.
   */
  data: Readonly<Record<string, string>>;
}

export interface EmailDeliveryResult {
  /** Identificador do envio no provedor, quando houver. Vai para a auditoria. */
  providerMessageId: string | null;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

export interface RenderedEmail {
  subject: string;
  text: string;
}

function required(data: Readonly<Record<string, string>>, key: string): string {
  const value = data[key];
  if (value === undefined || value === '') {
    throw new Error(`Email template data is missing the required field: ${key}`);
  }
  return value;
}

/**
 * Renderização em texto puro, sem HTML.
 *
 * Texto puro não é limitação, é a escolha: e-mail de sistema jurídico não precisa de layout,
 * e HTML abriria a porta para interpolar conteúdo sem escapar. O corpo aqui é o mesmo que
 * chega ao destinatário, e ele nunca é registrado em log nem em auditoria.
 */
export function renderEmail(message: EmailMessage): RenderedEmail {
  switch (message.templateId) {
    case 'invitation': {
      const organization = required(message.data, 'organizationName');
      return {
        subject: `Convite para acessar o ${organization} no LEX OS`,
        text: [
          `${required(message.data, 'recipientName')},`,
          '',
          `Você foi convidada a acessar o ${organization} no LEX OS.`,
          'Use o endereço abaixo para definir sua senha e concluir o acesso:',
          '',
          required(message.data, 'link'),
          '',
          `O convite vale até ${required(message.data, 'expiresAt')} e serve uma única vez.`,
          'Se você não esperava este convite, ignore esta mensagem.',
        ].join('\n'),
      };
    }
    // Conteúdo mínimo, sempre (ADR-013): código interno do caso, o que aconteceu em
    // linguagem de gente, e um link. Nunca título de documento, teor extraído, nome de parte,
    // documento de identificação ou mensagem técnica de erro. Um e-mail interceptado revela
    // que o caso teve movimento, e nada além disso.
    case 'document-failed': {
      const caseCode = required(message.data, 'caseCode');
      return {
        subject: `Documento não pôde ser preparado — caso ${caseCode}`,
        text: [
          `${required(message.data, 'recipientName')},`,
          '',
          `Um documento do caso ${caseCode} não pôde ser preparado e precisa de atenção.`,
          'Abra o caso para ver qual é e o que fazer:',
          '',
          required(message.data, 'link'),
          '',
          'Este é o único aviso que não pode ser desligado: documento parado costuma custar prazo.',
        ].join('\n'),
      };
    }
    case 'task-assigned': {
      const caseCode = required(message.data, 'caseCode');
      return {
        subject: `Tarefa atribuída a você — caso ${caseCode}`,
        text: [
          `${required(message.data, 'recipientName')},`,
          '',
          `Uma tarefa do caso ${caseCode} foi atribuída a você.`,
          'Abra a tarefa para ver o que é e o prazo:',
          '',
          required(message.data, 'link'),
        ].join('\n'),
      };
    }
    case 'preparation-digest': {
      return {
        subject: 'Preparação de documentos concluída no LEX OS',
        text: [
          `${required(message.data, 'recipientName')},`,
          '',
          `${required(message.data, 'documentCount')} documento(s) terminaram a preparação nos casos sob sua responsabilidade.`,
          `Casos com movimento: ${required(message.data, 'caseCodes')}.`,
          '',
          'Abra o painel para conferir:',
          '',
          required(message.data, 'link'),
        ].join('\n'),
      };
    }
    case 'password-reset': {
      return {
        subject: 'Redefinição de senha no LEX OS',
        text: [
          `${required(message.data, 'recipientName')},`,
          '',
          `Recebemos um pedido para redefinir sua senha no ${required(message.data, 'organizationName')}.`,
          'Se foi você, use o endereço abaixo:',
          '',
          required(message.data, 'link'),
          '',
          `O pedido vale até ${required(message.data, 'expiresAt')} e serve uma única vez.`,
          'Se não foi você, ignore esta mensagem: sua senha atual continua valendo.',
        ].join('\n'),
      };
    }
  }
}

/**
 * Adaptador determinístico para desenvolvimento e teste.
 *
 * Guarda o que seria enviado em memória em vez de entregar. O teste inspeciona a caixa; o
 * ambiente local sem Mailpit não quebra. Recusa produção pelo mesmo motivo dos demais mocks:
 * um provedor que não entrega, entregando silêncio, é pior que uma falha.
 */
export class RecordingEmailProvider implements EmailProvider {
  readonly name = 'recording';
  readonly sent: (EmailMessage & RenderedEmail)[] = [];

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const rendered = renderEmail(message);
    this.sent.push({ ...message, ...rendered });
    return { providerMessageId: null };
  }

  clear(): void {
    this.sent.length = 0;
  }
}
