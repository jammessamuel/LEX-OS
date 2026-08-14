import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class UpdateProcessingBudgetRequestDto {
  @ApiProperty({ example: '25.000000', description: 'Teto rígido do caso em BRL.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o teto de processamento como valor decimal.' })
  @Matches(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/u, {
    message: 'Informe um teto entre 0 e 999999999999 com até 6 casas decimais.',
  })
  limitAmount!: string;
}
