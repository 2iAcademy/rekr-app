import { ConsoleLogger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

type Level = 'info' | 'warn' | 'error' | 'fatal';

/**
 * Nest's own bootstrap chatter: one line per module and per route on every
 * start. It stays on stdout, where it helps reading a failed boot, but sent to
 * Sentry it would only bury the application's logs under ~80 lines a deploy.
 */
const BOOTSTRAP_CONTEXTS = new Set([
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
  'NestFactory',
  'NestApplication',
]);

/**
 * The console logger, unchanged, that also copies each log, warn, error and
 * fatal line to Sentry Logs.
 *
 * Without it the logs only live in the containers on the server: reading them
 * takes an SSH session and `docker compose logs`, and they cannot be searched
 * across restarts or alerted on. Sentry is already where errors and the uptime
 * monitor are; the logs land next to them, tagged with the service that wrote
 * them (`context`). Debug and verbose stay local: they are for a developer at
 * the console, not for the quota.
 *
 * With no DSN the SDK is disabled (`instrument.ts`) and the copy is a no-op,
 * so tests and local runs need nothing.
 */
export class SentryLogger extends ConsoleLogger {
  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message, ...optionalParams);
    this.forward('info', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams);
    this.forward('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    this.forward('error', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message, ...optionalParams);
    this.forward('fatal', message, optionalParams);
  }

  private forward(
    level: Level,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    // Nest passes the context last, and for `error` the stack just before it.
    const params = [...optionalParams];
    const last = params.at(-1);
    const context =
      typeof last === 'string' ? (params.pop() as string) : this.context;
    if (context && BOOTSTRAP_CONTEXTS.has(context)) {
      return;
    }

    const stack =
      level === 'error' && typeof params[0] === 'string'
        ? params[0]
        : undefined;
    const attributes: Record<string, string> = {};
    if (context) {
      attributes.context = context;
    }
    if (stack) {
      attributes.stack = stack;
    }

    Sentry.logger[level](toText(message), attributes);
  }
}

function toText(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  return JSON.stringify(message) ?? String(message);
}
