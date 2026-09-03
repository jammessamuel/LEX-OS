#!/usr/bin/env node
/**
 * Auditoria de dependências de produção, com a falha dizendo qual das duas falhas foi.
 *
 * `pnpm audit` sai com código 1 tanto quando encontra vulnerabilidade quanto quando não
 * consegue falar com o banco de advisories do registro. Em 2026-09-03 o endpoint ficou fora e
 * derrubou dois jobs da esteira com "Process completed with exit code 1" — a mesma mensagem que
 * uma vulnerabilidade real produziria. Duas rodadas de diagnóstico foram gastas nisso.
 *
 * O remédio NÃO é tolerar a falha: auditoria que não consultou não verificou nada, e deixar
 * passar seria abrir a porta silenciosamente. O remédio é separar as duas na saída, para que
 * quem lê a esteira saiba se procura um pacote vulnerável ou espera o registro voltar. Nos dois
 * casos o processo sai com código diferente de zero.
 */

import { spawnSync } from 'node:child_process';

const INDISPONIBILIDADE = [
  'ERR_PNPM_AUDIT_BAD_RESPONSE',
  'The operation was aborted due to timeout',
  'TimeoutError',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'socket hang up',
  'request to https://registry.npmjs.org',
];

const resultado = spawnSync('corepack', ['pnpm', 'audit', '--prod', '--audit-level', 'high'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const saida = `${resultado.stdout ?? ''}${resultado.stderr ?? ''}`;
process.stdout.write(saida);

if (resultado.status === 0) {
  process.exit(0);
}

const indisponivel = INDISPONIBILIDADE.some((marca) => saida.includes(marca));
if (indisponivel) {
  process.stderr.write(
    '\n::error title=Banco de advisories inacessível::' +
      'A auditoria não conseguiu consultar o registro do npm, então nada foi verificado. ' +
      'Isto não é um achado de vulnerabilidade: é indisponibilidade externa. ' +
      'Reexecute o job quando o registro responder.\n',
  );
  process.exit(2);
}

process.stderr.write(
  '\n::error title=Dependência de produção vulnerável::' +
    'A auditoria encontrou vulnerabilidade de severidade alta ou superior nas dependências de ' +
    'produção. Corrija a versão ou registre a correção em `overrides`, no ' +
    '`pnpm-workspace.yaml`.\n',
);
process.exit(resultado.status ?? 1);
