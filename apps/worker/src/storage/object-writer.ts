export const OBJECT_WRITER = Symbol('OBJECT_WRITER');

export interface WriteObjectInput {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * O worker escreve objeto, e só.
 *
 * Ler, listar, apagar e assinar URL são coisas da API — dar tudo isso a um processo de fundo
 * seria ampliar a superfície sem precisar. O contrato existe para o teste poder trocar o
 * armazenamento por um duplo em memória sem subir MinIO.
 */
export interface ObjectWriter {
  writeObject(input: WriteObjectInput): Promise<void>;
}
