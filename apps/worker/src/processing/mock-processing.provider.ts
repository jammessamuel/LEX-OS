import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { SourceText } from './review-processing.provider.js';

/**
 * O que a classificação recebe.
 *
 * O catálogo sozinho não classifica nada: até 2026-08-26 esta chamada não recebia argumento
 * algum, e o prompt mandava distinguir minuta de contrato assinado sobre um documento que o
 * provedor nunca via. O mock continua devolvendo OUTRO — quem precisa da entrada é o provedor
 * real, e o contrato tem de existir antes dele.
 */
export interface ClassificationInput {
  availableTypeCodes: readonly string[];
  sourceText: SourceText;
}

export interface MockTextResult {
  provider: string;
  modelName: string;
  rawText: string;
  confidence: number;
}

export interface ProcessingProvider {
  extractText(mimeType: string): MockTextResult;
  classify(input: ClassificationInput): {
    provider: string;
    modelName: string;
    code: 'OUTRO';
    confidence: number;
  };
  extractEntities(input: { sourceText: SourceText }): {
    provider: string;
    modelName: string;
    entities: readonly {
      entityType: string;
      normalizedValue: string;
      originalValue: string;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
      confidenceScore: number;
    }[];
  };
}

export const PROCESSING_PROVIDER = Symbol('PROCESSING_PROVIDER');

/**
 * Os dados que o documento realmente traz, cada um no seu lugar no texto.
 *
 * Antes disto o extrator determinístico não recebia o texto sequer: devolvia sempre um contrato
 * "LEX-2026-0001" e a data "05/08/2026", com deslocamentos fixos. Num cartão de ponto de março a
 * tela mostrava as duas como "dados identificados", com botão de confirmar ao lado — e confirmar
 * é ato humano que vale. O sistema pedia a um advogado que assinasse embaixo de dado inventado.
 *
 * A varredura reconhece o que tem forma inequívoca em documento brasileiro. Não infere, não
 * completa e não adivinha: cada achado é um recorte literal do texto, com o intervalo exato.
 * Documento sem nenhum desses devolve lista vazia, que é a resposta certa.
 */
const PADROES: readonly {
  tipo: string;
  expressao: RegExp;
  normaliza?: (bruto: string) => string;
}[] = [
  { tipo: 'CNPJ', expressao: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/gu },
  { tipo: 'CPF', expressao: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/gu },
  { tipo: 'CASE_NUMBER', expressao: /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/gu },
  {
    tipo: 'MONETARY_VALUE',
    expressao: /R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/gu,
    // Forma canônica do valor: só os dígitos e o separador decimal, para somar sem reparsear.
    normaliza: (bruto) => bruto.replace(/[^\d,]/gu, '').replace(',', '.'),
  },
  {
    tipo: 'DATE',
    expressao: /\b(\d{2})\/(\d{2})\/(\d{4})\b/gu,
    normaliza: (bruto) => {
      const [dia, mes, ano] = bruto.split('/');
      return `${ano}-${mes}-${dia}`;
    },
  },
];

/** Quantos dados o extrator determinístico devolve, no máximo. */
const MAX_ENTIDADES = 20;

function dadosNoTexto(conteudo: string): {
  entityType: string;
  normalizedValue: string;
  originalValue: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  confidenceScore: number;
}[] {
  const achados = [];
  for (const { tipo, expressao, normaliza } of PADROES) {
    for (const achado of conteudo.matchAll(expressao)) {
      const bruto = achado[0];
      achados.push({
        entityType: tipo,
        normalizedValue: normaliza === undefined ? bruto : normaliza(bruto),
        originalValue: bruto,
        pageNumber: 1,
        startOffset: achado.index,
        endOffset: achado.index + bruto.length,
        // A varredura lê o que está escrito; o que o dado significa para o caso continua sendo
        // juízo de quem revisa, e por isso a entidade nasce não confirmada.
        confidenceScore: 1,
      });
    }
  }
  // Na ordem em que aparecem no documento, que é como quem confere lê. O corte vem depois da
  // ordenação: as primeiras páginas são as que identificam o documento.
  achados.sort((a, b) => a.startOffset - b.startOffset);
  return achados.slice(0, MAX_ENTIDADES);
}

@Injectable()
export class MockProcessingProvider implements ProcessingProvider {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The mock processing provider cannot run in production.');
    }
  }

  extractText(mimeType: string): MockTextResult {
    return {
      provider: mimeType.startsWith('text/') ? 'lex-os-mock-text' : 'lex-os-mock-ocr',
      modelName: 'deterministic-v1',
      rawText:
        'Contrato fictício LEX-2026-0001, celebrado em 05/08/2026. Conteúdo exclusivo para desenvolvimento.',
      confidence: mimeType.startsWith('text/') ? 1 : 0.97,
    };
  }

  classify(): {
    provider: string;
    modelName: string;
    code: 'OUTRO';
    confidence: number;
  } {
    return {
      provider: 'lex-os-mock-classifier',
      modelName: 'deterministic-v1',
      code: 'OUTRO',
      confidence: 0.51,
    };
  }

  extractEntities(input: { sourceText: SourceText }): {
    provider: string;
    modelName: string;
    entities: readonly {
      entityType: string;
      normalizedValue: string;
      originalValue: string;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
      confidenceScore: number;
    }[];
  } {
    return {
      provider: 'lex-os-mock-entities',
      modelName: 'deterministic-v1',
      entities: dadosNoTexto(input.sourceText.content),
    };
  }
}
