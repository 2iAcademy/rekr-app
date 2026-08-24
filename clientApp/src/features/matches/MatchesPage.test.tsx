import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchControllerFindMine } from '@/api/generated';
import { MatchesPage } from './MatchesPage';

vi.mock('@/api/generated', () => ({
  matchControllerFindMine: vi.fn(),
}));

const getMatches = vi.mocked(matchControllerFindMine);

describe('MatchesPage', () => {
  beforeEach(() => {
    getMatches.mockResolvedValue({
      data: [
        {
          id: 12,
          matchedAt: new Date().toISOString(),
          offer: { id: 4, title: 'Développeur Full-Stack' },
          counterpart: {
            id: 8,
            kind: 'company',
            name: 'Acme Corp',
            headline: 'Développeur Full-Stack',
            avatarUrl: null,
          },
        },
      ],
    } as Awaited<ReturnType<typeof matchControllerFindMine>>);
  });

  it('affiche les onglets et les matches récupérés depuis l’API', async () => {
    render(<MatchesPage />);

    expect(screen.getByRole('heading', { name: 'Tes matches' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
    expect(getMatches).toHaveBeenCalledOnce();
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Développeur Full-Stack')).toBeInTheDocument();
  });

  it('change les éléments affichés lorsque le filtre change', async () => {
    const user = userEvent.setup();
    render(<MatchesPage />);

    await screen.findByText('Acme Corp');
    await user.click(screen.getByRole('tab', { name: 'Mes likes' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Mes likes' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(screen.getByText('Aster Studio')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('affiche un état vide lorsque l’API ne retourne aucun match', async () => {
    getMatches.mockResolvedValueOnce({
      data: [],
    } as Awaited<ReturnType<typeof matchControllerFindMine>>);

    render(<MatchesPage />);

    expect(await screen.findByText('Aucun match pour le moment.')).toBeInTheDocument();
  });

  it('affiche une erreur lorsque le chargement des matches échoue', async () => {
    getMatches.mockRejectedValueOnce(new Error('API indisponible'));

    render(<MatchesPage />);

    expect(await screen.findByText('Impossible de charger tes matches.')).toBeInTheDocument();
  });

  it('convertit la clé de stockage de l’avatar en URL de fichier', async () => {
    getMatches.mockResolvedValueOnce({
      data: [
        {
          id: 12,
          matchedAt: new Date().toISOString(),
          offer: { id: 4, title: 'Développeur Full-Stack' },
          counterpart: {
            id: 8,
            kind: 'company',
            name: 'Acme Corp',
            headline: 'Développeur Full-Stack',
            avatarUrl: 'companies/8/logo/acme.webp',
          },
        },
      ],
    } as Awaited<ReturnType<typeof matchControllerFindMine>>);

    const { container } = render(<MatchesPage />);

    await screen.findByText('Acme Corp');

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/files/companies/8/logo/acme.webp',
    );
  });
});
