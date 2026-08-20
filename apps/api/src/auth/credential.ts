import { createHash, randomBytes } from 'node:crypto';

import argon2 from 'argon2';

/**
 * Primitivas de credencial, em um lugar só.
 *
 * Estavam privadas no serviço de autenticação. O convite precisa exatamente das mesmas —
 * token opaco, hash do token, hash de senha — e duplicá-las abriria a porta para as duas
 * cópias divergirem justamente nos parâmetros que definem a força do hash.
 */

const TOKEN_BYTES = 32;

/**
 * Parâmetros do Argon2id. Um segundo lugar que decidisse isso sozinho poderia gravar senha
 * com custo menor sem ninguém perceber, porque a verificação lê o custo do próprio hash.
 */
const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Token opaco para portador: entregue uma vez e nunca reconstruível a partir do banco. */
export function newOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * SHA-256 sem sal, de propósito: a entrada é um token aleatório de 256 bits, não uma senha
 * escolhida por pessoa. Não há dicionário a defender, e o hash precisa ser determinístico
 * para servir de chave de busca em uma única consulta indexada.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, passwordHashOptions);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash descartável para o caminho de erro custar o mesmo tempo que o de sucesso. */
export function dummyPasswordHash(): Promise<string> {
  return hashPassword('lex-os-invalid-credential-comparison');
}
