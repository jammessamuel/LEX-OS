import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Segundo fator por código temporário (RFC 6238).
 *
 * Implementado aqui, e não trazido de biblioteca, porque o algoritmo inteiro cabe em algumas
 * dezenas de linhas sobre `node:crypto`: um HMAC-SHA1 sobre o número do passo de tempo, um
 * truncamento e um módulo. Uma dependência para isso seria superfície de cadeia de suprimento
 * sem ganho — e este é justamente o código que não convém ter surpresa.
 *
 * A escolha de SHA-1 não é descuido: é o que os aplicativos autenticadores implementam, e
 * trocar o algoritmo quebraria a compatibilidade com todos eles. A força do esquema não vem
 * do hash, vem do segredo e da janela de trinta segundos.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
/** Um passo para cada lado. Relógio de celular erra alguns segundos; minutos, não. */
const DRIFT_STEPS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 sem preenchimento, que é o formato que os autenticadores leem. */
export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(value: string): Buffer {
  const clean = value.replace(/[\s=]/gu, '').toUpperCase();
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error('The shared secret is not valid base32.');
    }
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Vinte bytes: o tamanho do bloco do HMAC-SHA1, e o que os autenticadores esperam. */
export function newTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

function codeForStep(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(counter).digest();

  // Truncamento dinâmico da RFC 4226: o último nibble escolhe de onde ler quatro bytes.
  // Lê-los de uma vez, em vez de byte a byte, deixa o deslocamento explícito e dispensa
  // quatro verificações de índice que só existiriam para o compilador.
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fff_ffff;

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function totpCodeAt(secret: string, atMs: number): string {
  return codeForStep(decodeBase32(secret), Math.floor(atMs / 1000 / STEP_SECONDS));
}

/**
 * Confere o código aceitando um passo de deriva para cada lado.
 *
 * A comparação é de tempo constante. Comparar com `===` vazaria, pelo tempo de resposta,
 * quantos dígitos iniciais estavam certos — o que transforma seis dígitos em seis
 * adivinhações de dez possibilidades.
 */
export function verifyTotp(secret: string, code: string, atMs: number = Date.now()): boolean {
  const candidate = code.replace(/\D/gu, '');
  if (candidate.length !== DIGITS) {
    return false;
  }

  const key = decodeBase32(secret);
  const currentStep = Math.floor(atMs / 1000 / STEP_SECONDS);
  const expected = Buffer.from(candidate, 'utf8');

  let matched = false;
  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift += 1) {
    const actual = Buffer.from(codeForStep(key, currentStep + drift), 'utf8');
    // Sem curto-circuito: sair no primeiro acerto revelaria pelo tempo qual passo casou.
    if (timingSafeEqual(actual, expected)) {
      matched = true;
    }
  }
  return matched;
}

/** Passo atual, para o servidor recusar a reapresentação do mesmo código. */
export function totpStepAt(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / STEP_SECONDS);
}

/**
 * Endereço que o aplicativo autenticador lê no QR.
 *
 * O rótulo leva o nome do escritório para quem tem vários acessos distinguir na lista, e o
 * emissor é fixo: é assim que o aplicativo agrupa.
 */
export function totpUri(input: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const query = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/**
 * Cifra do segredo em repouso, AES-256-GCM.
 *
 * Um despejo do banco não pode entregar o segundo fator. Sem isso, quem obtivesse a base
 * geraria códigos válidos para qualquer pessoa, e o fator adicional viraria encenação.
 *
 * O formato guardado é `iv:tag:conteudo`, tudo em base64url — o vetor de inicialização e a
 * etiqueta de autenticação não são segredos, e precisam acompanhar o texto cifrado.
 */
export function encryptSecret(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join(':');
}

export function decryptSecret(stored: string, key: Buffer): string {
  const [iv, tag, payload] = stored.split(':');
  if (iv === undefined || tag === undefined || payload === undefined) {
    throw new Error('The stored second-factor secret is malformed.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Códigos de recuperação: dez, de uso único, para quem perdeu o telefone.
 *
 * Sem eles, trocar de aparelho vira chamado para o suporte — e um caminho de socorro manual
 * é exatamente o que o item 8 do ADR-014 recusou.
 */
export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
