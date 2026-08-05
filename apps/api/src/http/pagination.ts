import { HttpStatus } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { ApiException } from './api-exception.js';

export class CursorPaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'O cursor deve ser uma string.' })
  @MaxLength(512, { message: 'O cursor excede o limite permitido.' })
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite mínimo é 1.' })
  @Max(100, { message: 'O limite máximo é 100.' })
  limit = 20;
}

export interface CursorPage<T> {
  data: readonly T[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export function encodeCursor(value: Readonly<Record<string, string>>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T>(
  cursor: string | undefined,
  parse: (value: unknown) => T | undefined,
): T | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  try {
    if (!/^[A-Za-z0-9_-]+$/u.test(cursor)) {
      throw new Error('Cursor contains unsupported characters.');
    }

    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const parsed = parse(value);

    if (parsed === undefined) {
      throw new Error('Cursor has an unexpected shape.');
    }

    return parsed;
  } catch {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'INVALID_CURSOR',
      'Cursor de paginação inválido.',
    );
  }
}
