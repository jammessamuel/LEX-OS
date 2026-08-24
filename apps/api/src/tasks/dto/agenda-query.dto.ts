import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class AgendaQueryDto {
  /**
   * Início da janela, como instante ISO.
   *
   * Quem decide o fuso é o navegador, que conhece o do usuário — o servidor guarda tudo em UTC
   * e não tem como adivinhar onde fica o escritório. Ausente, a janela começa agora.
   */
  @ApiPropertyOptional({ format: 'date-time', example: '2026-08-24T03:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'Informe o início da janela como data e hora ISO.' })
  from?: string;

  /** Fim da janela. Ausente, catorze dias depois do início: a agenda é da quinzena, não do ano. */
  @ApiPropertyOptional({ format: 'date-time', example: '2026-09-07T02:59:59.999Z' })
  @IsOptional()
  @IsDateString({}, { message: 'Informe o fim da janela como data e hora ISO.' })
  to?: string;

  /** `mine` restringe ao usuário autenticado; `all` mostra a agenda do escritório. */
  @ApiPropertyOptional({ enum: ['mine', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['mine', 'all'], { message: 'Informe um recorte de agenda válido.' })
  scope?: 'mine' | 'all';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um responsável válido.' })
  assignedToId?: string;
}
