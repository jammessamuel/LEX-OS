import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SearchCitationDto } from '../../search/dto/search-response.dto.js';

export class GroundedClaimDto {
  @ApiProperty()
  text!: string;

  @ApiProperty({ type: [SearchCitationDto], minItems: 1 })
  citations!: SearchCitationDto[];
}

export class GroundedAnswerModelDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  modelName!: string;

  @ApiProperty()
  modelVersion!: string;

  @ApiProperty()
  promptVersion!: string;

  @ApiProperty()
  executionId!: string;

  @ApiProperty({ example: '0.000000' })
  costAmount!: string;

  @ApiProperty({ example: 'BRL' })
  costCurrency!: string;
}

export class GroundedAnswerResponseDto {
  @ApiProperty({ enum: ['ANSWER', 'INSUFFICIENT_EVIDENCE'] })
  status!: 'ANSWER' | 'INSUFFICIENT_EVIDENCE';

  @ApiProperty({ example: true })
  machineGenerated!: true;

  @ApiProperty({ example: 'Conteúdo gerado por máquina; exige revisão humana.' })
  disclaimer!: string;

  @ApiPropertyOptional({ nullable: true })
  answer!: string | null;

  @ApiProperty({ type: [GroundedClaimDto] })
  claims!: GroundedClaimDto[];

  @ApiPropertyOptional({ type: GroundedAnswerModelDto, nullable: true })
  model!: GroundedAnswerModelDto | null;
}
