import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchPage } from './MatchPage';

const renderPage = (props: Partial<React.ComponentProps<typeof MatchPage>> = {}) =>
  render(
    <MatchPage currentUser={{ name: 'Camille' }} matchedProfile={{ name: 'Acme' }} {...props} />,
  );

describe('MatchPage', () => {
  it('annonce l’intérêt réciproque et réunit les deux parties du match', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Acme a aussi retenu votre profil' }),
    ).toBeVisible();
    expect(screen.getByText('Intérêt réciproque')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Match entre vous et Acme' })).toHaveTextContent(
      /^CA$/,
    );
  });

  it('reste lisible sans savoir qui a matché', () => {
    renderPage({ matchedProfile: null });

    expect(screen.getByRole('heading', { level: 1, name: 'Nouveau match' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Votre match' })).toHaveTextContent(/^C$/);
  });

  it('récapitule l’offre concernée quand elle est connue', () => {
    renderPage({ offer: { title: 'Développeur Full-Stack', contract: 'CDI', city: 'Lyon' } });

    const recap = Object.fromEntries(
      screen
        .getAllByRole('term')
        .map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(recap).toEqual({ Offre: 'Développeur Full-Stack', Contrat: 'CDI', Ville: 'Lyon' });
  });

  it('n’affiche que les lignes connues du récapitulatif, et rien sans offre', () => {
    const { unmount } = renderPage({
      offer: { title: 'Data Analyst', contract: null, city: 'Lyon' },
    });

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Offre', 'Ville']);
    unmount();

    renderPage();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
  });

  it('affiche les actions de messagerie et de continuation', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Écrire un message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer à swiper' })).toBeInTheDocument();
  });

  it('affiche les avatars lorsque leurs URLs sont disponibles', () => {
    renderPage({
      currentUser: { name: 'Camille', avatarUrl: '/camille.png' },
      matchedProfile: { name: 'Acme', avatarUrl: '/acme.png' },
    });

    expect(screen.getByRole('img', { name: 'Camille' })).toHaveAttribute('src', '/camille.png');
    expect(screen.getByRole('img', { name: 'Acme' })).toHaveAttribute('src', '/acme.png');
  });

  it('convertit la clé de stockage de l’avatar en URL de fichier', () => {
    renderPage({ matchedProfile: { name: 'Acme', avatarUrl: 'companies/8/logo/acme.webp' } });

    expect(screen.getByRole('img', { name: 'Acme' })).toHaveAttribute(
      'src',
      '/api/files/companies/8/logo/acme.webp',
    );
  });

  it('déclenche les actions correspondantes', async () => {
    const user = userEvent.setup();
    const onWriteMessage = vi.fn();
    const onContinue = vi.fn();
    renderPage({ onWriteMessage, onContinue });

    await user.click(screen.getByRole('button', { name: 'Écrire un message' }));
    await user.click(screen.getByRole('button', { name: 'Continuer à swiper' }));

    expect(onWriteMessage).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
