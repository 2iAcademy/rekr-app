import { buildPasswordResetEmail } from './password-reset-email';

describe('buildPasswordResetEmail', () => {
  const message = buildPasswordResetEmail({
    to: 'candidate@test.dev',
    link: 'https://app.rekr.test/reinitialiser-mot-de-passe?token=abc123',
    ttlMinutes: 60,
  });

  it('addresses the requested recipient', () => {
    expect(message.to).toBe('candidate@test.dev');
  });

  it('carries the link in both the text and the HTML body', () => {
    expect(message.text).toContain(
      'https://app.rekr.test/reinitialiser-mot-de-passe?token=abc123',
    );
    expect(message.html).toContain(
      'href="https://app.rekr.test/reinitialiser-mot-de-passe?token=abc123"',
    );
  });

  it('states how long the link stays valid', () => {
    expect(message.text).toContain('60 minutes');
    expect(message.html).toContain('60 minutes');
  });

  it('is written in French', () => {
    expect(message.subject).toBe('Réinitialisation de votre mot de passe');
    expect(message.text).toContain('Bonjour');
  });

  it('escapes the link before dropping it into the HTML body', () => {
    const escaped = buildPasswordResetEmail({
      to: 'candidate@test.dev',
      link: 'https://app.rekr.test/r?token=a&b"><script>',
      ttlMinutes: 15,
    });

    expect(escaped.html).not.toContain('<script>');
    expect(escaped.html).toContain('&amp;b&quot;&gt;');
  });
});
