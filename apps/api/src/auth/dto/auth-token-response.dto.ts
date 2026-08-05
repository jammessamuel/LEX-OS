import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Administrador Fictício' })
  name!: string;

  @ApiProperty({ example: 'admin@lexos.invalid' })
  email!: string;
}

export class AuthenticatedOrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Lex OS Demonstração' })
  tradeName!: string;
}

export class AuthTokenResponseDto {
  @ApiProperty({ description: 'JWT de curta duração.', writeOnly: true })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;

  @ApiProperty({ type: AuthenticatedOrganizationDto })
  organization!: AuthenticatedOrganizationDto;
}
