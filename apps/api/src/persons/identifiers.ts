import { registerDecorator, type ValidationOptions } from 'class-validator';

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/u.test(value);
}

function cpfDigit(digits: string, position: 9 | 10): number {
  let sum = 0;

  for (let index = 0; index < position; index += 1) {
    sum += Number(digits[index]) * (position + 1 - index);
  }

  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: string): boolean {
  return (
    /^\d{11}$/u.test(value) &&
    !hasRepeatedDigits(value) &&
    cpfDigit(value, 9) === Number(value[9]) &&
    cpfDigit(value, 10) === Number(value[10])
  );
}

function cnpjDigit(digits: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/u.test(value) || hasRepeatedDigits(value)) {
    return false;
  }

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  return (
    cnpjDigit(value, firstWeights) === Number(value[12]) &&
    cnpjDigit(value, secondWeights) === Number(value[13])
  );
}

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
