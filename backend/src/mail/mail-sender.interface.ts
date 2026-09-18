/**
 * The seam between whatever wants to send an e-mail and whatever actually
 * delivers it.
 *
 * It exists so that the tests never touch nodemailer: a service under test is
 * given a double implementing this interface, and what it asserts on is the
 * message it built, not the SMTP dialogue that would carry it. Mocking the
 * transport library instead would tie every such test to nodemailer's own API.
 */
export const MAIL_SENDER = 'MAIL_SENDER';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
