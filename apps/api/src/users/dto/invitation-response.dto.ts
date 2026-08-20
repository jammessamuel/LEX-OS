import { ApiProperty } from '@nestjs/swagger';

export class InvitedUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['INVITED', 'ACTIVE', 'BLOCKED', 'INACTIVE'] })
  status!: 'INVITED' | 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
}

export class InvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: InvitedUserDto })
  user!: InvitedUserDto;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  /**
   * Devolvido uma única vez, na resposta do convite, e nunca mais.
   *
   * Não existe adapter de e-mail (ADR-013), então quem convida entrega o token à pessoa por
   * um canal que escolhe. O valor não vai para log nem para auditoria, e o banco guarda só o
   * hash: perdeu, revoga e convida de novo. Ver ADR-014, item 2.
   */
  @ApiProperty({
    description:
      'Token de uso único, exibido apenas nesta resposta. Entregue por canal seguro; ' +
      'não é recuperável depois.',
  })
  token!: string;
}
