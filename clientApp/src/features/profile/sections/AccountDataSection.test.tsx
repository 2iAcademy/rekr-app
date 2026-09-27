import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { accountControllerDelete, accountControllerExport } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { Toaster } from '@/components/ui/sonner';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { AccountDataSection } from './AccountDataSection';

vi.mock('@/api/generated', () => ({
  accountControllerDelete: vi.fn(),
  accountControllerExport: vi.fn(),
}));

const deleteRequest = vi.mocked(accountControllerDelete);
const exportRequest = vi.mocked(accountControllerExport);

const session = (): AuthContextValue => ({
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
  logout: vi.fn(),
  accountDeleted: vi.fn(),
  markProfileCompleted: vi.fn(),
});

const renderSection = (value: AuthContextValue = session()) => {
  render(
    <AuthContext.Provider value={value}>
      <AccountDataSection />
      <Toaster />
    </AuthContext.Provider>,
  );

  return value;
};

const apiError = (status: number) =>
  new ApiError({ status, statusText: '', url: '/api/account', data: {} });

describe('AccountDataSection', () => {
  const createObjectURL = vi.fn<(content: Blob) => string>(() => 'blob:rekr-export');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('export', () => {
    it('télécharge un fichier JSON contenant les données renvoyées par l’API', async () => {
      const user = userEvent.setup();
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      exportRequest.mockResolvedValue({
        data: { exportedAt: '2026-09-23T10:00:00.000Z', account: { id: 1 } },
        status: 200,
        headers: new Headers(),
      } as Awaited<ReturnType<typeof accountControllerExport>>);
      renderSection();

      await user.click(screen.getByRole('button', { name: 'Télécharger mes données' }));

      await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('application/json');
      expect(JSON.parse(await blob.text())).toEqual({
        exportedAt: '2026-09-23T10:00:00.000Z',
        account: { id: 1 },
      });
      const anchor = click.mock.contexts[0] as HTMLAnchorElement;
      expect(anchor.download).toBe('rekr-export-2026-09-23.json');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:rekr-export');
    });

    it('signale un échec sans rien télécharger', async () => {
      const user = userEvent.setup();
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      exportRequest.mockRejectedValue(apiError(500));
      renderSection();

      await user.click(screen.getByRole('button', { name: 'Télécharger mes données' }));

      expect(await screen.findByText(/erreur est survenue/)).toBeInTheDocument();
      expect(click).not.toHaveBeenCalled();
    });
  });

  describe('suppression', () => {
    it('ne supprime rien au premier clic : il demande le mot de passe', async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));

      expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
      expect(screen.getByText(/La suppression est définitive/)).toBeInTheDocument();
      expect(deleteRequest).not.toHaveBeenCalled();
    });

    it('supprime le compte avec le mot de passe saisi puis ferme la session', async () => {
      const user = userEvent.setup();
      deleteRequest.mockResolvedValue({
        data: undefined,
        status: 204,
        headers: new Headers(),
      } as Awaited<ReturnType<typeof accountControllerDelete>>);
      const value = renderSection();

      await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
      await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
      await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

      await waitFor(() => expect(value.accountDeleted).toHaveBeenCalledTimes(1));
      expect(deleteRequest).toHaveBeenCalledWith({ password: 'motdepasse1' });
      expect(await screen.findByText('Votre compte a été supprimé.')).toBeInTheDocument();
    });

    it('garde la session et explique un mot de passe refusé', async () => {
      const user = userEvent.setup();
      deleteRequest.mockRejectedValue(apiError(403));
      const value = renderSection();

      await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
      await user.type(screen.getByLabelText('Mot de passe'), 'mauvais-mdp');
      await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

      expect(await screen.findByText('Mot de passe incorrect.')).toBeInTheDocument();
      expect(value.accountDeleted).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    });

    it('renonce sans rien envoyer', async () => {
      const user = userEvent.setup();
      renderSection();

      await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
      await user.click(screen.getByRole('button', { name: 'Annuler' }));

      expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument();
      expect(deleteRequest).not.toHaveBeenCalled();
    });
  });
});
