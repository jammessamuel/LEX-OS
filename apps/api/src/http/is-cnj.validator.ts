import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidCnj } from '@lex-os/shared';

/**
 * Valida o número único do CNJ na fronteira, incluindo o dígito verificador.
 *
 * Conferir apenas a forma deixaria entrar um número com um dígito trocado — que atravessa o
 * sistema inteiro parecendo real e só falha no dia em que alguém tenta consultar o processo
 * no tribunal. O cálculo vive em `@lex-os/shared`, e é o mesmo que a interface usa para
 * avisar antes de enviar.
 */
export function IsCnj(options?: ValidationOptions) {
  return function decorate(object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCnj',
      target: object.constructor,
      propertyName,
      ...(options === undefined ? {} : { options }),
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidCnj(value);
        },
      },
    });
  };
}
