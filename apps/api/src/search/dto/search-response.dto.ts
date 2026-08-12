import { ApiProperty } from '@nestjs/swagger';

export class SearchCitationDto {
  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty({ format: 'uuid' })
  documentId!: string;

  @ApiProperty({ format: 'uuid' })
  extractionId!: string;

  @ApiProperty({ minimum: 1 })
  pageNumber!: number;

  @ApiProperty({ minimum: 0 })
  startOffset!: number;

  @ApiProperty({ minimum: 1 })
  endOffset!: number;

  @ApiProperty({ pattern: '^[a-f0-9]{64}$' })
  contentHash!: string;
}

export class SearchResultDto {
  @ApiProperty({ format: 'uuid' })
  chunkId!: string;

  @ApiProperty()
  excerpt!: string;

  @ApiProperty({ enum: ['HYBRID', 'LEXICAL', 'SEMANTIC'] })
  matchedBy!: 'HYBRID' | 'LEXICAL' | 'SEMANTIC';

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: SearchCitationDto })
  citation!: SearchCitationDto;
}

export class SearchResponseDto {
  @ApiProperty({ enum: ['RESULTS', 'INSUFFICIENT_EVIDENCE'] })
  status!: 'RESULTS' | 'INSUFFICIENT_EVIDENCE';

  @ApiProperty({ enum: ['HYBRID', 'LEXICAL', 'SEMANTIC'] })
  mode!: 'HYBRID' | 'LEXICAL' | 'SEMANTIC';

  @ApiProperty({ minimum: 0 })
  resultCount!: number;

  @ApiProperty({ type: [SearchResultDto] })
  results!: SearchResultDto[];
}
