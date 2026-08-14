import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  participantRoles,
  participantSides,
  type ParticipantRoleCode,
  type ParticipantSideCode,
} from '../../participants/participant.constants.js';
import { CaseResponseDto } from './case-response.dto.js';

export class PersonCaseParticipationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: participantRoles })
  role!: ParticipantRoleCode;

  @ApiPropertyOptional({ enum: participantSides, nullable: true })
  side!: ParticipantSideCode | null;

  @ApiProperty()
  isClient!: boolean;
}

export class PersonCaseResponseDto {
  @ApiProperty({ type: CaseResponseDto })
  case!: CaseResponseDto;

  @ApiProperty({ type: [PersonCaseParticipationDto] })
  participations!: PersonCaseParticipationDto[];
}

export class PersonCaseListResponseDto {
  @ApiProperty({ type: [PersonCaseResponseDto] })
  data!: PersonCaseResponseDto[];

  @ApiProperty({ example: { nextCursor: 'opaque-cursor', hasNextPage: true } })
  pageInfo!: { nextCursor: string | null; hasNextPage: boolean };
}
