import { ApiProperty } from '@nestjs/swagger';
import { silenceableNotifications, type SilenceableNotification } from '@lex-os/shared';
import { ArrayUnique, IsArray, IsIn } from 'class-validator';

/**
 * Quais avisos a pessoa desligou (ADR-013).
 *
 * O corpo é a lista inteira, e não uma operação de ligar ou desligar um. Substituir o conjunto
 * evita a corrida de duas abas mandando pedidos opostos, e faz a tela ser a fonte do que a
 * pessoa quer — em vez de o servidor ter de reconstruir a intenção a partir de deltas.
 *
 * A falha de documento não está no catálogo aceito. Tentar silenciá-la é recusado no boundary,
 * antes de chegar ao domínio.
 */
export class NotificationPreferencesRequestDto {
  @ApiProperty({
    description: 'Avisos silenciados. Falha de documento não pode ser silenciada.',
    enum: silenceableNotifications,
    isArray: true,
  })
  @IsArray({ message: 'Informe a lista de avisos silenciados.' })
  @ArrayUnique({ message: 'A lista não pode repetir o mesmo aviso.' })
  @IsIn(silenceableNotifications, {
    each: true,
    message: 'Este aviso não existe ou não pode ser silenciado.',
  })
  silenced!: SilenceableNotification[];
}

export class NotificationPreferencesDto {
  @ApiProperty({
    description: 'Avisos que esta pessoa desligou.',
    enum: silenceableNotifications,
    isArray: true,
  })
  silenced!: SilenceableNotification[];

  @ApiProperty({
    description: 'Todos os avisos que podem ser desligados, para a tela não precisar saber.',
    enum: silenceableNotifications,
    isArray: true,
  })
  silenceable!: readonly SilenceableNotification[];
}
