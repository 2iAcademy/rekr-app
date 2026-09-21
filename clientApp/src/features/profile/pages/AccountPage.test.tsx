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

  it('affiche l’initiale de l’utilisateur dans son avatar', () => {
    renderPage();

    expect(screen.getByText('C')).toBeInTheDocument();
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

  // La page reste présentationnelle : la déconnexion du téléphone est ajoutée
  // par la route (voir routes.test.tsx), la tablette et le bureau ont la leur
  // dans le chrome.
  it('ne porte pas elle-même la déconnexion', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument();
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
