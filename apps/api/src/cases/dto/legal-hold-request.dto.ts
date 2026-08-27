import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Põe ou retira a retenção obrigatória de um caso (ADR-012).
 *
 * O motivo é exigido nos dois sentidos. Pôr sem motivo deixa o próximo a olhar sem saber por que
 * o caso não pode ser tocado; retirar sem motivo apaga a única explicação de quem respondeu pela
 * liberação — e é a retirada que a auditoria vai querer explicar depois.
 */
export class LegalHoldRequestDto {
  @ApiProperty({
    description: 'Verdadeiro para pôr a retenção, falso para retirá-la.',
  })
  @IsBoolean({ message: 'Informe se a retenção deve ser posta ou retirada.' })
  hold!: boolean;

  @ApiProperty({
    description: 'Motivo registrado da retenção ou da liberação.',
    minLength: 3,
    maxLength: 500,
  })
  @IsString({ message: 'O motivo deve ser um texto.' })
  @MinLength(3, { message: 'O motivo deve ter pelo menos 3 caracteres.' })
  @MaxLength(500, { message: 'O motivo excede o limite permitido.' })
  reason!: string;
}
