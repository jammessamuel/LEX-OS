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

  /**
   * Por que a resposta foi recusada. `null` quando houve resposta.
   *
   * As duas recusas dizem coisas diferentes para quem lê, e confundi-las é pior do que não
   * distinguir: `NO_AUTHORIZED_SOURCE` significa que a pesquisa não trouxe nada que este usuário
   * possa ver, e sugere que o acervo não tem o assunto; `SOURCES_DO_NOT_SUPPORT` significa que
   * trechos foram recuperados, lidos pelo modelo, e nenhum sustenta a resposta — o acervo tem
   * material sobre o caso, só não sobre esta pergunta. Dizer a primeira quando é a segunda manda
   * o advogado procurar em outro lugar um documento que já está aqui.
   */
  @ApiPropertyOptional({
    enum: ['NO_AUTHORIZED_SOURCE', 'SOURCES_DO_NOT_SUPPORT'],
    nullable: true,
  })
  refusalReason!: 'NO_AUTHORIZED_SOURCE' | 'SOURCES_DO_NOT_SUPPORT' | null;
}
