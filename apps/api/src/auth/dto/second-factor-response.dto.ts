import { ApiProperty } from '@nestjs/swagger';

export class SecondFactorStatusDto {
  @ApiProperty()
  active!: boolean;

  @ApiProperty({ description: 'Quando verdadeiro, o escritório não deixa desligar.' })
  requiredByOrganization!: boolean;

  @ApiProperty({ description: 'Quantos códigos de recuperação ainda não foram usados.' })
  unusedRecoveryCodes!: number;
}

export class SecondFactorEnrolmentDto {
  /**
   * Sai uma única vez, para o aplicativo. Não há rota que o leia de novo, ele não entra em
   * log nem em auditoria, e no banco vive cifrado.
   */
  @ApiProperty({ description: 'Segredo em base32, para digitar quando o QR não puder ser lido.' })
  secret!: string;

  @ApiProperty({ description: 'Endereço otpauth:// que o aplicativo lê no QR.' })
  uri!: string;
}

export class SecondFactorActivatedDto {
  @ApiProperty({
    type: [String],
    description:
      'Exibidos uma única vez. Guardados apenas em hash: perdidos, só desligando e ' +
      'religando o segundo fator.',
  })
  recoveryCodes!: string[];
}
