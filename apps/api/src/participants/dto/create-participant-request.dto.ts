import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import {
  participantRoles,
  participantSides,
  type ParticipantRoleCode,
  type ParticipantSideCode,
} from '../participant.constants.js';

export class CreateParticipantRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe uma pessoa válida.' })
  personId!: string;

  @ApiProperty({ enum: participantRoles, example: 'reclamante' })
  @IsIn(participantRoles, { message: 'Informe um papel de participante válido.' })
  role!: ParticipantRoleCode;

  @ApiPropertyOptional({ enum: participantSides, nullable: true, example: 'polo_ativo' })
  @IsOptional()
  @IsIn(participantSides, { message: 'Informe um polo válido.' })
  side?: ParticipantSideCode | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Informe corretamente se o participante é cliente.' })
  isClient?: boolean;
}
