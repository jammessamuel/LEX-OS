import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InviteUserRequestDto {
  @ApiProperty({ example: 'Ana Fictícia de Souza', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o nome da pessoa.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(255, { message: 'O nome excede o limite permitido.' })
  name!: string;

  @ApiProperty({ example: 'ana@escritorio.invalid', maxLength: 320 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(320, { message: 'O e-mail excede o limite permitido.' })
  email!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Papéis atribuídos ao aceitar. Só papéis globais ou do próprio escritório são aceitos, ' +
      'e apenas os que quem convida já possui — convidar não pode ser caminho de escalada.',
  })
  @IsArray({ message: 'Informe uma lista de papéis válida.' })
  @ArrayMaxSize(10, { message: 'Selecione no máximo 10 papéis.' })
  @IsUUID('4', { each: true, message: 'Informe um papel válido.' })
  roleIds: string[] = [];
}
