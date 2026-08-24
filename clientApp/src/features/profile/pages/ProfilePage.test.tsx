import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from './ProfilePage';

const renderPage = (props: Partial<React.ComponentProps<typeof ProfilePage>> = {}) =>
  render(<ProfilePage email="camille@rekr.fr" roleLabel="Candidat" {...props} />);

describe('ProfilePage', () => {
  it('affiche le titre de l’écran', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Profil' })).toBeInTheDocument();
  });

  it('affiche l’email et le libellé de rôle de l’utilisateur', () => {
    renderPage();

    expect(screen.getByText('camille@rekr.fr')).toBeInTheDocument();
    expect(screen.getByText('Candidat')).toBeInTheDocument();
  });

  it('affiche le libellé de rôle d’un recruteur', () => {
    renderPage({ email: 'sacha@acme.fr', roleLabel: 'Recruteur' });

    expect(screen.getByText('sacha@acme.fr')).toBeInTheDocument();
    expect(screen.getByText('Recruteur')).toBeInTheDocument();
  });

  it('annonce que le contenu du profil reste à venir', () => {
    renderPage();

    expect(screen.getByText(/arrive bientôt/i)).toBeInTheDocument();
  });

  it('ne rend aucun main, le shell en fournit déjà un', () => {
    renderPage();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
