import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LoggingMailSender } from './logging-mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';
import { createMailSender } from './mail-sender.factory';

const configOf = (values: Record<string, string>): ConfigService =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('createMailSender', () => {
  it('falls back to the logging sender when SMTP_HOST is unset', () => {
    expect(createMailSender(configOf({}))).toBeInstanceOf(LoggingMailSender);
  });

  it('falls back to the logging sender when SMTP_HOST is blank', () => {
    expect(createMailSender(configOf({ SMTP_HOST: '   ' }))).toBeInstanceOf(
      LoggingMailSender,
    );
  });

  it('refuses to start in production rather than log reset links in clear', () => {
    expect(() =>
      createMailSender(configOf({ NODE_ENV: 'production' })),
    ).toThrow(/SMTP_HOST/);
  });

  it('builds an SMTP sender once a host is configured', () => {
    const sender = createMailSender(
      configOf({ SMTP_HOST: 'smtp.example.test', MAIL_FROM: 'no-reply@rekr' }),
    );

    expect(sender).toBeInstanceOf(SmtpMailSender);
  });
});

describe('LoggingMailSender', () => {
  it('writes the recipient, the subject and the body to the log', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await new LoggingMailSender().send({
      to: 'candidate@test.dev',
      subject: 'Réinitialisation',
      text: 'https://app.test/reinitialiser-mot-de-passe?token=abc',
      html: '<p>lien</p>',
    });

    const written = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(written).toContain('candidate@test.dev');
    expect(written).toContain('Réinitialisation');
    expect(written).toContain('token=abc');

    log.mockRestore();
  });
});

describe('SmtpMailSender', () => {
  const transport = { sendMail: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => transport.sendMail.mockClear());

  it('hands the message to the transport with the configured sender address', async () => {
    const sender = new SmtpMailSender(transport, 'Rekr <no-reply@rekr.test>');

    await sender.send({
      to: 'candidate@test.dev',
      subject: 'Réinitialisation',
      text: 'texte',
      html: '<p>html</p>',
    });

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'Rekr <no-reply@rekr.test>',
      to: 'candidate@test.dev',
      subject: 'Réinitialisation',
      text: 'texte',
      html: '<p>html</p>',
    });
  });
});
