import type { MailMessage } from '../mail/mail-sender.interface';

interface PasswordResetEmail {
  to: string;
  link: string;
  ttlMinutes: number;
}

/**
 * The link is escaped before reaching the HTML body even though it is built
 * here rather than submitted: the token is base64url and `APP_URL` comes from
 * the environment, so neither should carry markup today. Escaping costs
 * nothing and keeps a future change to either from turning this template into
 * an injection point in someone's mail client.
 */
export function buildPasswordResetEmail({
  to,
  link,
  ttlMinutes,
}: PasswordResetEmail): MailMessage {
  const href = escapeHtml(link);

  return {
    to,
    subject: 'Réinitialisation de votre mot de passe',
    text: [
      'Bonjour,',
      '',
      'Vous avez demandé à réinitialiser votre mot de passe Rekr. Ouvrez le lien ci-dessous pour en choisir un nouveau :',
      link,
      '',
      `Ce lien est valable ${ttlMinutes} minutes et ne peut servir qu'une seule fois.`,
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
      '',
      "L'équipe Rekr",
    ].join('\n'),
    html: [
      '<p>Bonjour,</p>',
      '<p>Vous avez demandé à réinitialiser votre mot de passe Rekr. Ouvrez le lien ci-dessous pour en choisir un nouveau :</p>',
      `<p><a href="${href}">Choisir un nouveau mot de passe</a></p>`,
      `<p>Ce lien est valable ${ttlMinutes} minutes et ne peut servir qu'une seule fois.</p>`,
      "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>",
      "<p>L'équipe Rekr</p>",
    ].join('\n'),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
