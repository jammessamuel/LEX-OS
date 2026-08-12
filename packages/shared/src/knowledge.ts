import { createHash } from 'node:crypto';

export const deterministicEmbeddingDescriptor = {
  provider: 'lex-os-mock-embedding',
  model: 'deterministic-hash-v1',
  version: '1',
  dimensions: 16,
} as const;

export interface EmbeddingDescriptor {
  provider: string;
  model: string;
  version: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  readonly descriptor: EmbeddingDescriptor;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export interface KnowledgeSourceLocator {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

export interface DeterministicKnowledgeChunk {
  chunkIndex: number;
  content: string;
  contentHash: string;
  locator: KnowledgeSourceLocator;
}

interface NormalizedText {
  content: string;
  sourceStarts: number[];
  sourceEnds: number[];
}

const whitespacePattern = /\s/u;

function normalizeWithSourceMap(source: string): NormalizedText {
  const characters: string[] = [];
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index] ?? '';
    const isCrLf = current === '\r' && source[index + 1] === '\n';
    const sourceEnd = index + (isCrLf ? 2 : 1);
    const normalized =
      current === '\0' || current === '\r' || whitespacePattern.test(current) ? ' ' : current;

    if (normalized === ' ') {
      if (characters.length === 0) {
        if (isCrLf) {
          index += 1;
        }
        continue;
      }
      if (characters.at(-1) === ' ') {
        sourceEnds[sourceEnds.length - 1] = sourceEnd;
      } else {
        characters.push(' ');
        sourceStarts.push(index);
        sourceEnds.push(sourceEnd);
      }
    } else {
      characters.push(normalized);
      sourceStarts.push(index);
      sourceEnds.push(sourceEnd);
    }

    if (isCrLf) {
      index += 1;
    }
  }

  if (characters.at(-1) === ' ') {
    characters.pop();
    sourceStarts.pop();
    sourceEnds.pop();
  }

  return { content: characters.join(''), sourceStarts, sourceEnds };
}

function safeBoundary(content: string, start: number, maximumEnd: number): number {
  if (maximumEnd >= content.length) {
    return content.length;
  }

  const wordBoundary = content.lastIndexOf(' ', maximumEnd);
  if (wordBoundary > start + Math.floor((maximumEnd - start) / 2)) {
    return wordBoundary;
  }

  const previousCodeUnit = content.charCodeAt(maximumEnd - 1);
  const currentCodeUnit = content.charCodeAt(maximumEnd);
  const splitsSurrogatePair =
    previousCodeUnit >= 0xd800 &&
    previousCodeUnit <= 0xdbff &&
    currentCodeUnit >= 0xdc00 &&
    currentCodeUnit <= 0xdfff;
  return splitsSurrogatePair ? maximumEnd - 1 : maximumEnd;
}

function nextChunkStart(
  content: string,
  currentStart: number,
  end: number,
  overlap: number,
): number {
  if (end >= content.length) {
    return content.length;
  }

  const overlapTarget = Math.max(currentStart + 1, end - overlap);
  const nextSpace = content.indexOf(' ', overlapTarget);
  if (nextSpace >= 0 && nextSpace < end) {
    return nextSpace + 1;
  }
  return end;
}

export function chunkKnowledgeText(
  source: string,
  options: { maximumCharacters?: number; overlapCharacters?: number; pageNumber?: number } = {},
): readonly DeterministicKnowledgeChunk[] {
  const maximumCharacters = options.maximumCharacters ?? 800;
  const overlapCharacters = options.overlapCharacters ?? 120;
  const pageNumber = options.pageNumber ?? 1;

  if (
    !Number.isInteger(maximumCharacters) ||
    maximumCharacters < 32 ||
    !Number.isInteger(overlapCharacters) ||
    overlapCharacters < 0 ||
    overlapCharacters >= maximumCharacters ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {
    throw new Error('Invalid deterministic chunking configuration.');
  }

  const normalized = normalizeWithSourceMap(source);
  if (normalized.content.length === 0) {
    return [];
  }

  const chunks: DeterministicKnowledgeChunk[] = [];
  let start = 0;

  while (start < normalized.content.length) {
    const maximumEnd = Math.min(start + maximumCharacters, normalized.content.length);
    const end = safeBoundary(normalized.content, start, maximumEnd);
    const content = normalized.content.slice(start, end);
    const startOffset = normalized.sourceStarts[start];
    const endOffset = normalized.sourceEnds[end - 1];

    if (startOffset === undefined || endOffset === undefined || content.length === 0) {
      throw new Error('Deterministic chunking lost its source locator.');
    }

    chunks.push({
      chunkIndex: chunks.length,
      content,
      contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
      locator: { pageNumber, startOffset, endOffset },
    });
    start = nextChunkStart(normalized.content, start, end, overlapCharacters);
  }

  return chunks;
}

function deterministicVector(text: string, dimensions: number): readonly number[] {
  const values = Array.from({ length: dimensions }, () => 0);
  const tokens = text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) ?? [text];

  for (const token of tokens) {
    const digest = createHash('sha256').update(token, 'utf8').digest();
    const bucket = digest.readUInt16BE(0) % dimensions;
    const direction = (digest[2] ?? 0) % 2 === 0 ? 1 : -1;
    values[bucket] = (values[bucket] ?? 0) + direction * (1 + Math.min(token.length, 20) / 20);
  }

  let norm = Math.sqrt(values.reduce((total, value) => total + value * value, 0));
  if (norm === 0) {
    values[0] = 1;
    norm = 1;
  }
  return values.map((value) => Number((value / norm).toFixed(8)));
}

export function assertEmbeddingBatch(
  embeddings: readonly (readonly number[])[],
  expectedCount: number,
  expectedDimensions: number,
): void {
  if (
    embeddings.length !== expectedCount ||
    embeddings.some(
      (embedding) =>
        embedding.length !== expectedDimensions ||
        embedding.some((coordinate) => !Number.isFinite(coordinate)),
    )
  ) {
    throw new Error('Embedding provider returned an invalid vector batch.');
  }
}

export class DeterministicMockEmbeddingProvider implements EmbeddingProvider {
  readonly descriptor: EmbeddingDescriptor = deterministicEmbeddingDescriptor;

  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    const embeddings = texts.map((text) => deterministicVector(text, this.descriptor.dimensions));
    return Promise.resolve(embeddings);
  }
}
