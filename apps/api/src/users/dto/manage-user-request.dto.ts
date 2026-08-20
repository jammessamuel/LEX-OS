import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsUUID } from 'class-validator';

export class ReplaceUserRolesRequestDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Conjunto completo de papéis, não um acréscimo. Só papéis globais ou do próprio ' +
      'escritório, e apenas os cujas permissões quem atribui já possui.',
  })
  @IsArray({ message: 'Informe uma lista de papéis válida.' })
  @ArrayMaxSize(10, { message: 'Selecione no máximo 10 papéis.' })
  @IsUUID('4', { each: true, message: 'Informe um papel válido.' })
  roleIds!: string[];
}

export class ChangeUserStatusRequestDto {
  @ApiProperty({
    enum: ['ACTIVE', 'BLOCKED'],
    description:
      'Bloquear revoga as sessões de atualização na mesma transação. Reativar só age sobre ' +
      'quem está bloqueado: quem foi convidado e não aceitou ainda não tem senha.',
  })
  @IsIn(['ACTIVE', 'BLOCKED'], { message: 'Informe uma situação válida.' })
  status!: 'ACTIVE' | 'BLOCKED';
}
