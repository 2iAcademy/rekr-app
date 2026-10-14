import { externalCall } from '../observability/failure-log';
import type { MailMessage, MailSender } from './mail-sender.interface';

export interface MailTransport {
  sendMail(message: MailMessage & { from: string }): Promise<unknown>;
}

export class SmtpMailSender implements MailSender {
  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    await externalCall('smtp', 'send_mail', () =>
      this.transport.sendMail({ from: this.from, ...message }),
    );
  }
}
