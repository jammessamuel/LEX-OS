import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationRequestDto {
  @ApiProperty({
    description: 'Token recebido no convite. De uso único e com validade.',
    writeOnly: true,
    maxLength: 128,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o token do convite.' })
  @MinLength(20, { message: 'Informe um convite válido.' })
  @MaxLength(128, { message: 'Informe um convite válido.' })
  token!: string;

  @ApiProperty({ format: 'password', writeOnly: true, minLength: 12, maxLength: 128 })
  @IsString({ message: 'Informe a senha.' })
  // Doze, e não os oito da entrada: aqui a senha está sendo criada, e é o único momento em
  // que dá para exigir mais sem trancar quem já tem acesso.
  @MinLength(12, { message: 'A senha deve ter pelo menos 12 caracteres.' })
  @MaxLength(128, { message: 'A senha excede o limite permitido.' })
  password!: string;
}
