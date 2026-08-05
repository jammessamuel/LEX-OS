import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_METADATA = 'lex-os:required-permissions';

export const RequirePermissions = (...permissions: readonly string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_METADATA, permissions);
