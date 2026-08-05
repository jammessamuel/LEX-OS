import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_METADATA = 'lex-os:public-route';
export const Public = () => SetMetadata(PUBLIC_ROUTE_METADATA, true);
