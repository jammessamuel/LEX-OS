import { Inject, Injectable } from '@nestjs/common';

import { OBJECT_READER, type ObjectReader } from '../storage/object-reader.js';
import { PROCESSING_PROVIDER, type ProcessingProvider } from './mock-processing.provider.js';
import { PermanentProcessingError } from './processing-error.js';

/**
 * Quanto texto de um documento entra no acervo pesquisável.
 *
 * Mesmo teto que a biblioteca de prompts usa para o que vai ao modelo. Um documento maior é
 * lido até aqui e o corte é registrado — melhor um caso com metade do texto e o aviso do que um
 * worker que morre no PDF de duzentas páginas.
 */
export const MAX_EXTRACTED_BYTES = 262_144;

export interface ExtractedText {
  provider: string;
  modelName: string;
  rawText: string;
  confidence: number;
  truncated: boolean;
}

/**
 * A extração de texto de um documento.
 *
 * Arquivo de texto **não precisa de IA**: precisa ser aberto. Até 2026-09-01 esta etapa chamava
 * o provedor determinístico para todo tipo de arquivo, e ele devolvia a mesma frase de noventa e
 * nove caracteres para qualquer documento — de modo que cronologia, entidades, checklist, busca
 * e assistente, todos, liam o mesmo carimbo em vez do documento. Subir um contrato de verdade
 * não mudava nada, e isso não aparecia em teste nenhum porque o mock era coerente consigo mesmo.
 *
 * Agora `text/*` é lido do armazenamento. PDF e imagem continuam no mock, e aí a simulação é
 * honesta: reconhecer caractere em imagem é trabalho que exige um provedor de verdade, e fingir
 * que temos um seria a mentira que esta classe existe para desfazer.
 */
@Injectable()
export class TextExtractionService {
  constructor(
    @Inject(OBJECT_READER) private readonly reader: ObjectReader,
    @Inject(PROCESSING_PROVIDER) private readonly provider: ProcessingProvider,
  ) {}

  async extract(file: {
    mimeType: string;
    storageBucket: string;
    storageKey: string;
  }): Promise<ExtractedText> {
    if (!file.mimeType.startsWith('text/')) {
      const mock = this.provider.extractText(file.mimeType);
      return { ...mock, truncated: false };
    }

    const objeto = await this.reader.readObject({
      bucket: file.storageBucket,
      key: file.storageKey,
      maxBytes: MAX_EXTRACTED_BYTES,
    });
    // `fatal: false` de propósito: byte inválido vira o caractere de substituição em vez de
    // derrubar a etapa. Um documento com um trecho ilegível ainda vale mais que nenhum — e a
    // instrução do modelo já manda tratar o ilegível como ilegível.
    const texto = new TextDecoder('utf-8', { fatal: false }).decode(objeto.body).trim();

    if (texto === '') {
      throw new PermanentProcessingError(
        'EMPTY_DOCUMENT_TEXT',
        'O arquivo de texto está vazio e não há o que extrair.',
      );
    }

    return {
      provider: 'lex-os-text-reader',
      modelName: 'utf8-v1',
      rawText: texto,
      // Ler um arquivo de texto não tem incerteza: ou leu, ou falhou. Confiança abaixo de um
      // aqui seria número decorativo, e a instrução do modelo usa esse campo para calibrar.
      confidence: 1,
      truncated: objeto.truncated,
    };
  }
}
