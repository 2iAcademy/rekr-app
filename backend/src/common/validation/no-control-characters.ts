import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * C0 controls (except tab / newline / carriage return), DEL and the C1 range.
 *
 * The load-bearing one is U+0000: Postgres rejects it in any `text` column
 * with SQLSTATE 22021. Reaching the database with it turns a 400 into a 500 on
 * the tag path, and — worse — wedges the Kafka log sink, which has no
 * dead-letter path and replays the offending batch forever.
 *
 * The rest of the range is refused on the same pass because it has no business
 * in a label or a log line: U+001B in particular smuggles terminal escape
 * sequences into anything that later renders logs in a console.
 *
 * Tab, newline and carriage return stay allowed: a stack trace is a legitimate
 * log message.
 */
const CONTROL_CHARACTERS =
  // eslint-disable-next-line no-control-regex -- matching control characters is the entire point
  /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/;

export function containsControlCharacters(value: string): boolean {
  return CONTROL_CHARACTERS.test(value);
}

export function NoControlCharacters(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'noControlCharacters',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value !== 'string' || !containsControlCharacters(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not contain control characters`;
        },
      },
    });
  };
}
