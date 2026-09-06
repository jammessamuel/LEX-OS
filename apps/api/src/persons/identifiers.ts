import { registerDecorator, type ValidationOptions } from 'class-validator';

import { isValidCnpj, isValidCpf } from '@lex-os/shared';

// O digito verificador vive em @lex-os/shared: a mesma regra vale para o cadastro de pessoa e
// para a extracao de dados no worker, e duas copias divergiriam em silencio.
export { isValidCnpj, isValidCpf };

export function digitsOnly(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/\D/gu, '') : value;
}

export function maskCpf(value: string | null): string | null {
  return value === null ? null : `***.***.***-${value.slice(-2)}`;
}

export function maskCnpj(value: string | null): string | null {
  return value === null ? null : `**.***.***/****-${value.slice(-2)}`;
}

export function maskRg(value: string | null): string | null {
  return value === null ? null : `****${value.slice(-4)}`;
}

export function IsCpf(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions === undefined ? {} : { options: validationOptions }),
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidCpf(value) },
    });
  };
}

export function IsCnpj(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isCnpj',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions === undefined ? {} : { options: validationOptions }),
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidCnpj(value) },
    });
  };
}
