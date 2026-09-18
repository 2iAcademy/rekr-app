import { Logger } from '@nestjs/common';
import type { MailMessage, MailSender } from './mail-sender.interface';

/**
 * The sender used whenever no SMTP host is configured — local development, and
 * CI, where an outbound connection would either hang or, worse, actually
 * deliver. Writing the whole message to the log keeps the flow usable: the
 * reset link is right there in the terminal, so the feature can be walked
 * end-to-end without a mail server.
 *
 * This is why it prints the link in full rather than redacting it, and why it
 * must never be selected in production: whoever reads the logs could reset any
 * account. `createMailSender` picks it only on an empty `SMTP_HOST`.
 */
export class LoggingMailSender implements MailSender {
  private readonly logger = new Logger(LoggingMailSender.name);

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `No SMTP host configured — e-mail not sent. to=${message.to} subject=${message.subject}\n${message.text}`,
    );

    return Promise.resolve();
  }
}
