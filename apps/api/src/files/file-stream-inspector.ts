import { createHash, type Hash } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';
import { TextDecoder } from 'node:util';

import { fileTypeFromBuffer } from 'file-type';

import { FileIntakeError } from './file-intake-error.js';
import type { VirusInspectionSession, VirusScanOutcome } from './virus-scanner.js';

const prefixLimit = 8_192;
const tailLimit = 2_048;

const extensionsByMime = {
  'application/pdf': new Set(['pdf']),
  'image/jpeg': new Set(['jpeg', 'jpg']),
  'image/png': new Set(['png']),
  'text/plain': new Set(['txt']),
} as const;

export const supportedFileMimeTypes = Object.freeze(Object.keys(extensionsByMime));

export interface InspectedFile {
  checksumSha256: string;
  detectedMimeType: string;
  sizeBytes: number;
  virusScanStatus: VirusScanOutcome;
}

export class FileStreamInspector extends Transform {
  readonly #hash: Hash = createHash('sha256');
  readonly #scanner: VirusInspectionSession;
  readonly #utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  #prefix = Buffer.alloc(0);
  #tail = Buffer.alloc(0);
  #sizeBytes = 0;
  #textControlBytes = 0;
  #validUtf8 = true;
  #digest: string | undefined;

  constructor(scanner: VirusInspectionSession) {
    super();
    this.#scanner = scanner;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.#sizeBytes += chunk.length;
    this.#hash.update(chunk);
    this.#scanner.inspect(chunk);

    if (this.#prefix.length < prefixLimit) {
      const missing = prefixLimit - this.#prefix.length;
      this.#prefix = Buffer.concat([this.#prefix, chunk.subarray(0, missing)]);
    }
    this.#tail = Buffer.concat([this.#tail, chunk]).subarray(-tailLimit);

    for (const byte of chunk) {
      if (byte === 0 || byte < 9 || (byte > 13 && byte < 32)) {
        this.#textControlBytes += 1;
      }
    }
    if (this.#validUtf8) {
      try {
        this.#utf8Decoder.decode(chunk, { stream: true });
      } catch {
        this.#validUtf8 = false;
      }
    }

    callback(null, chunk);
  }

  override _flush(callback: TransformCallback): void {
    if (this.#validUtf8) {
      try {
        this.#utf8Decoder.decode();
      } catch {
        this.#validUtf8 = false;
      }
    }
    this.#digest = this.#hash.digest('hex');
    callback();
  }

  async result(clientMimeType: string, extension: string): Promise<InspectedFile> {
    if (this.#digest === undefined) {
      throw new Error('File inspection was requested before the stream completed.');
    }
    if (this.#sizeBytes === 0) {
      throw new FileIntakeError('EMPTY_FILE', 400, 'EMPTY_FILE', 'O arquivo está vazio.');
    }

    const detected = await fileTypeFromBuffer(this.#prefix);
    const textRatio = this.#textControlBytes / this.#sizeBytes;
    const detectedMimeType =
      detected?.mime ?? (this.#validUtf8 && textRatio <= 0.01 ? 'text/plain' : undefined);

    if (detectedMimeType === undefined || !(detectedMimeType in extensionsByMime)) {
      throw new FileIntakeError(
        'TYPE_NOT_ALLOWED',
        415,
        'FILE_TYPE_NOT_ALLOWED',
        'O tipo real do arquivo não é permitido.',
      );
    }
    if (clientMimeType.toLowerCase() !== detectedMimeType) {
      throw new FileIntakeError(
        'MIME_MISMATCH',
        415,
        'FILE_MIME_MISMATCH',
        'O conteúdo do arquivo não corresponde ao tipo informado.',
      );
    }
    const allowedExtensions = extensionsByMime[
      detectedMimeType as keyof typeof extensionsByMime
    ] as ReadonlySet<string>;
    if (!allowedExtensions.has(extension)) {
      throw new FileIntakeError(
        'INVALID_EXTENSION',
        415,
        'FILE_EXTENSION_MISMATCH',
        'A extensão não corresponde ao conteúdo do arquivo.',
      );
    }
    if (!this.#hasValidStructure(detectedMimeType)) {
      throw new FileIntakeError(
        'CORRUPTED_FILE',
        422,
        'CORRUPTED_FILE',
        'O arquivo está incompleto ou corrompido.',
      );
    }

    return {
      checksumSha256: this.#digest,
      detectedMimeType,
      sizeBytes: this.#sizeBytes,
      virusScanStatus: this.#scanner.complete(),
    };
  }

  #hasValidStructure(mimeType: string): boolean {
    if (mimeType === 'application/pdf') {
      return this.#tail.includes(Buffer.from('%%EOF', 'ascii'));
    }
    if (mimeType === 'image/png') {
      return this.#tail.includes(Buffer.from('IEND', 'ascii'));
    }
    if (mimeType === 'image/jpeg') {
      return this.#tail.length >= 2 && this.#tail.at(-2) === 0xff && this.#tail.at(-1) === 0xd9;
    }
    return mimeType === 'text/plain' && this.#validUtf8;
  }
}
