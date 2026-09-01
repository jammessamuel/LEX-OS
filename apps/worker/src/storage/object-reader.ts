export const OBJECT_READER = Symbol('OBJECT_READER');

export interface ReadObjectInput {
  bucket: string;
  key: string;
  /** Teto de bytes lidos. O que passar disso é cortado, e quem chamou fica sabendo. */
  maxBytes: number;
}

export interface ReadObjectResult {
  body: Buffer;
  /** Verdadeiro quando o objeto era maior que `maxBytes` e a leitura parou antes do fim. */
  truncated: boolean;
}

/**
 * Leitura de objeto, e nada além.
 *
 * O worker foi desenhado como escritor apenas, e a razão continua boa: listar, apagar e assinar
 * URL são da API, e dar tudo isso a um processo de fundo ampliaria a superfície sem precisar.
 *
 * Ler é a exceção necessária, e ela tem uma causa concreta: quem extrai o texto de um documento
 * é o worker, e extrair texto de um arquivo exige abrir o arquivo. Sem isto, a extração de um
 * `.txt` só podia inventar — e era o que fazia, devolvendo a mesma frase fixa para todo
 * documento do sistema.
 *
 * A alternativa seria a API ler e mandar os bytes pela fila. Seria pior: conteúdo de documento
 * jurídico passaria a viver no Redis, que não é lugar para isso.
 *
 * A porta é separada de `ObjectWriter` de propósito. Quem precisa escrever não ganha leitura de
 * brinde, e a ampliação de superfície fica visível em vez de diluída num contrato que cresce.
 */
export interface ObjectReader {
  readObject(input: ReadObjectInput): Promise<ReadObjectResult>;
}
