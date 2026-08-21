import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class SecondFactorCodeDto {
  @ApiProperty({
    example: '123456',
    description: 'Código de seis dígitos exibido pelo aplicativo autenticador.',
  })
  // Espaço no meio é como o aplicativo mostra, e quem digita copia o que vê.
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/gu, '') : value))
  @IsString({ message: 'Informe o código do aplicativo.' })
  @Matches(/^\d{6}$/u, { message: 'O código tem seis dígitos.' })
  code!: string;
}
