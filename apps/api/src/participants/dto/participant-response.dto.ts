import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { personTypes, type PersonTypeCode } from '../../persons/person.constants.js';
import {
  participantRoles,
  participantSides,
  type ParticipantRoleCode,
  type ParticipantSideCode,
} from '../participant.constants.js';

export class ParticipantPersonResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: personTypes })
  personType!: PersonTypeCode;

  @ApiProperty({ example: 'Pessoa Fictícia de Teste' })
  fullName!: string;

  @ApiPropertyOptional({ nullable: true })
  tradeName!: string | null;
}

export class ParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty({ enum: participantRoles })
  role!: ParticipantRoleCode;

  @ApiPropertyOptional({ enum: participantSides, nullable: true })
  side!: ParticipantSideCode | null;

  @ApiProperty()
  isClient!: boolean;

  @ApiProperty({ type: ParticipantPersonResponseDto })
  person!: ParticipantPersonResponseDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ParticipantListResponseDto {
  @ApiProperty({ type: [ParticipantResponseDto] })
  data!: ParticipantResponseDto[];

  @ApiProperty({ example: { nextCursor: 'opaque-cursor', hasNextPage: true } })
  pageInfo!: { nextCursor: string | null; hasNextPage: boolean };
}
