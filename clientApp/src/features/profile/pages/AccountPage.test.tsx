import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { AccountPage } from './AccountPage';

const session: AuthContextValue = {
  status: 'authenticated',
  user: {
    id: 1,
    email: 'camille@rekr.fr',
    role: 'user',
    userType: 'candidate',
    isActive: true,
    hasProfile: true,
  },
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  markProfileCompleted: vi.fn(),
};

// The page embeds the logout control, which reads the session from the context.
const renderPage = (props: Partial<React.ComponentProps<typeof AccountPage>> = {}) =>
  render(
    <AuthContext.Provider value={session}>
      <AccountPage email="camille@rekr.fr" roleLabel="Candidat" {...props} />
    </AuthContext.Provider>,
  );

describe('AccountPage', () => {
  it('affiche le titre de l’écran', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeInTheDocument();
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

  it('rend la section propre au rôle qu’on lui confie', () => {
    renderPage({ children: <p>Section candidat</p> });

    expect(screen.getByText('Section candidat')).toBeInTheDocument();
  });

  it('propose de se déconnecter', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
  });

  it('n’annonce plus un profil à venir', () => {
    renderPage();

    expect(screen.queryByText(/arrive bientôt/i)).not.toBeInTheDocument();
  });

  it('ne rend aucun main, le shell en fournit déjà un', () => {
    renderPage();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
