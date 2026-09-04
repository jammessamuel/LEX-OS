import { createConnection, type Socket } from 'node:net';

import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  renderEmail,
  type EmailDeliveryResult,
  type EmailMessage,
  type EmailProvider,
} from '@lex-os/shared';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

/**
 * Entrega por SMTP simples, para o Mailpit local.
 *
 * Este adaptador existe para tornar o fluxo **visível**: quem pede uma redefinição vê a
 * mensagem chegar em `localhost:8025`, em vez de ter de acreditar num teste. Ele fala o
 * subconjunto do SMTP que o Mailpit aceita — sem STARTTLS e sem autenticação — e é isso que
 * o torna inadequado a um relay de produção.
 *
 * Por isso ele recusa duas coisas, e as recusas são estruturais, não avisos:
 *
 * 1. `NODE_ENV=production`, como todos os mocks do projeto;
 * 2. um host que não seja local, para que apontá-lo a um relay externo por engano de
 *    configuração falhe na inicialização e não vaze mensagem em claro pela rede.
 *
 * O adaptador de produção entra junto com a escolha do relay, que segue em aberto no ADR-014.
 * Ele provavelmente usará uma biblioteca; escrever STARTTLS e AUTH à mão é exatamente onde
 * este tipo de código erra.
 */

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'mailpit']);
const REPLY_TIMEOUT_MS = 10_000;

/** Cabeçalho com acento precisa de palavra codificada; sem isso o assunto chega quebrado. */
function encodeHeader(value: string): string {
  return /^[ -~]*$/u.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/**
 * Corpo em base64.
 *
 * Resolve de uma vez o escape do ponto no início da linha, o limite de 998 caracteres e o
 * UTF-8 — três armadilhas que uma implementação em texto puro precisa tratar uma a uma.
 */
function encodeBody(text: string): string {
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (encoded.match(/.{1,76}/gu) ?? []).join('\r\n');
}

class SmtpSession {
  #buffer = '';
  #pending: {
    resolve: (reply: string) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor(private readonly socket: Socket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.#consume(chunk));
    socket.on('error', (error) => this.#reject(error));
    socket.on('close', () => this.#reject(new Error('SMTP connection closed early.')));
  }

  #reject(error: Error): void {
    const pending = this.#pending;
    if (pending === null) {
      return;
    }
    clearTimeout(pending.timeout);
    this.#pending = null;
    pending.reject(error);
  }

  /** Uma resposta termina na linha cujo quarto caractere é espaço; as com hífen continuam. */
  #consume(chunk: string): void {
    this.#buffer += chunk;
    this.#resolveBufferedReply();
  }

  #resolveBufferedReply(): void {
    const lines = this.#buffer.split('\r\n');
    const last = lines.at(-2);
    if (last === undefined || last.charAt(3) === '-') {
      return;
    }
    const pending = this.#pending;
    if (pending === null) {
      // O banner pode chegar entre a criação do socket e a chamada de `read`. Conservá-lo evita
      // perder uma resposta válida apenas porque a rede foi mais rápida que o chamador.
      return;
    }
    const reply = this.#buffer;
    this.#buffer = '';
    clearTimeout(pending.timeout);
    this.#pending = null;
    pending.resolve(reply);
  }

  read(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => this.#reject(new Error('SMTP reply timed out.')),
        REPLY_TIMEOUT_MS,
      );
      this.#pending = { resolve, reject, timeout };
      this.#resolveBufferedReply();
    });
  }

  async command(line: string, expected: string): Promise<string> {
    this.socket.write(`${line}\r\n`);
    const reply = await this.read();
    if (!reply.startsWith(expected)) {
      throw new Error(`SMTP command rejected: ${line.split(' ')[0]} -> ${reply.trim()}`);
    }
    return reply;
  }
}

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';

  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The plain SMTP adapter cannot run in production.');
    }
    if (!LOCAL_HOSTS.has(config.mail.host)) {
      throw new Error(
        `The plain SMTP adapter refuses a non-local host: ${config.mail.host}. ` +
          'It speaks no TLS and no authentication.',
      );
    }
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const rendered = renderEmail(message);
    const socket = createConnection({
      host: this.config.mail.host,
      port: this.config.mail.port,
      timeout: REPLY_TIMEOUT_MS,
    });

    try {
      const session = new SmtpSession(socket);
      await session.read();
      await session.command('EHLO lex-os', '250');
      await session.command(`MAIL FROM:<${this.config.mail.from}>`, '250');
      await session.command(`RCPT TO:<${message.recipient.address}>`, '250');
      await session.command('DATA', '354');

      const headers = [
        `From: ${this.config.mail.from}`,
        `To: ${message.recipient.address}`,
        `Subject: ${encodeHeader(rendered.subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
      ].join('\r\n');

      const accepted = await session.command(
        `${headers}\r\n\r\n${encodeBody(rendered.text)}\r\n.`,
        '250',
      );
      await session.command('QUIT', '221').catch(() => undefined);

      // O Mailpit devolve o identificador na própria confirmação; guardá-lo permite
      // reencontrar a mensagem depois sem precisar do corpo.
      const providerMessageId = /250 .*?([A-Za-z0-9._-]{6,})\s*$/u.exec(accepted.trim())?.[1];
      return { providerMessageId: providerMessageId ?? null };
    } finally {
      socket.destroy();
    }
  }
}
