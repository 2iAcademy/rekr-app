import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { LoggingMailSender } from './logging-mail-sender';
import type { MailSender } from './mail-sender.interface';
import { SmtpMailSender } from './smtp-mail-sender';

const DEFAULT_PORT = 587;
const DEFAULT_FROM = 'Rekr <no-reply@rekr.app>';

/**
 * `SMTP_HOST` is the switch, and an empty value counts as unset: a dotenv file
 * shipping `SMTP_HOST=` hands the variable through as an empty string, which
 * nodemailer would happily take before failing at connect time on every send.
 */
export function createMailSender(config: ConfigService): MailSender {
  const host = config.get<string>('SMTP_HOST')?.trim();
  if (!host) {
    // The fallback writes reset links to the log in clear, so in production it
    // is not a degraded mode but account takeover for whoever reads the logs.
    // Failing at boot is the same bargain `AuthModule` strikes over
    // `JWT_SECRET`: a security-critical setting left empty stops the API rather
    // than quietly changing what it guarantees.
    if (config.get<string>('NODE_ENV')?.trim() === 'production') {
      throw new Error(
        'SMTP_HOST is required in production: without it, password reset links would be written to the logs instead of being sent.',
      );
    }

    return new LoggingMailSender();
  }

  const user = config.get<string>('SMTP_USER')?.trim();
  const password = config.get<string>('SMTP_PASSWORD');

  const transport = createTransport({
    host,
    port: readPort(config),
    secure: config.get<string>('SMTP_SECURE')?.trim() === 'true',
    auth: user ? { user, pass: password ?? '' } : undefined,
  });

  return new SmtpMailSender(
    transport,
    config.get<string>('MAIL_FROM')?.trim() || DEFAULT_FROM,
  );
}

function readPort(config: ConfigService): number {
  const parsed = Number(config.get<string>('SMTP_PORT'));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}
