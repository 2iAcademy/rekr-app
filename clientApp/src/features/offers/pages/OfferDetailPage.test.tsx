import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { OfferDetailPage } from './OfferDetailPage';
import {
  offerControllerFindOneById,
  offerControllerLike,
  offerControllerPass,
  offerControllerUnlike,
} from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { Toaster } from '@/components/ui/sonner';

vi.mock('@/api/generated', () => ({
  jobFamilyControllerFindAll: vi.fn(() =>
    Promise.resolve({ data: [{ id: 13, label: 'Informatique' }] }),
  ),
  offerControllerFindOneById: vi.fn(),
  offerControllerLike: vi.fn(),
  offerControllerPass: vi.fn(),
  offerControllerUnlike: vi.fn(),
}));

const mockOffer = {
  id: 1,
  title: 'Développeur Full-Stack',
  description:
    'Équipe de 8 personnes, produit principal en forte croissance. Stack moderne, autonomie sur les choix techniques et environnement bienveillant.',
  city: 'Lyon',
  postalCode: '69000',
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: 45000,
  salaryMax: 55000,
  company: {
    id: 1,
    name: 'Acme Corp',
    logo: 'companies/1/logo/acme.png',
    size: 'PME',
    description:
      'Acme Corp construit des outils SaaS pour PME industrielles. Fondée en 2018, basée à Lyon, 35 personnes.',
    city: 'Lyon',
  },
  tags: [
    { label: 'React', category: 'tech' },
    { label: 'Node', category: 'tech' },
    { label: 'TypeScript', category: 'tech' },
    { label: 'Mutuelle', category: 'benefit' },
    { label: 'Tickets restaurant', category: 'benefit' },
  ],
};

const renderPage = (props: Partial<ComponentProps<typeof OfferDetailPage>> = {}) =>
  render(
    <MemoryRouter initialEntries={['/offres/1']}>
      <Routes>
        <Route path="/offres/:id" element={<OfferDetailPage {...props} />} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );

/** `liked` and `passed` are served to the candidate alone: on a recruiter's
 * read the keys are absent, they are not `false`. */
const offerSeenBy = (decision: { liked?: boolean; passed?: boolean }) =>
  ({
    data: { ...mockOffer, ...decision },
  }) as unknown as Awaited<ReturnType<typeof offerControllerFindOneById>>;

const apiError = (status: number, message: string) =>
  new ApiError({ status, statusText: '', url: '/api/offers/1/like', data: { message } });

const MATCH_CONFLICT = 'Cette offre a déjà donné lieu à un match : il ne peut pas être défait ici.';

describe('OfferDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(offerControllerPass).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof offerControllerPass>>,
    );
    vi.mocked(offerControllerUnlike).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof offerControllerUnlike>>,
    );
    vi.mocked(offerControllerLike).mockResolvedValue({
      data: {
        likeCreated: true,
        matchCreated: true,
        match: {
          id: 1,
          counterpart: {
            kind: 'company',
            name: mockOffer.company.name,
            avatarUrl: '/api/files/companies/1/logo/acme.png',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof offerControllerLike>>);
    vi.mocked(offerControllerFindOneById).mockResolvedValue({
      data: mockOffer,
    } as unknown as Awaited<ReturnType<typeof offerControllerFindOneById>>);
  });

  it("affiche le titre de l'offre", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: mockOffer.title })).toBeInTheDocument();
    });
  });

  // Les avantages sont portés par l'offre : c'est ce que le candidat lit avant
  // de liker, et ils diffèrent d'un poste à l'autre chez un même employeur.
  it("affiche les avantages de l'offre", async () => {
    renderPage();

    expect(await screen.findByText('Avantages')).toBeInTheDocument();
    expect(screen.getByText('Mutuelle')).toBeInTheDocument();
    expect(screen.getByText('Tickets restaurant')).toBeInTheDocument();
  });

  it("masque la section quand l'offre ne propose aucun avantage", async () => {
    vi.mocked(offerControllerFindOneById).mockResolvedValue({
      data: { ...mockOffer, tags: [] },
    } as unknown as Awaited<ReturnType<typeof offerControllerFindOneById>>);

    renderPage();

    await screen.findByRole('heading', { level: 2, name: mockOffer.title });
    expect(screen.queryByText('Avantages')).not.toBeInTheDocument();
  });

  it("affiche le nom de l'entreprise, taille et localisation", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(`${mockOffer.company.name} · ${mockOffer.company.size} · Lyon`),
      ).toBeInTheDocument();
    });
  });

  it('affiche le salaire en gras', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('45 - 55 k€')).toBeInTheDocument();
    });
  });

  it('affiche la stack technique', async () => {
    renderPage();

    await waitFor(() => {
      for (const tag of mockOffer.tags) {
        expect(screen.getByText(tag.label)).toBeInTheDocument();
      }
    });
  });

  it('affiche les en-têtes de sections en majuscules', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Stack technique')).toBeInTheDocument();
      expect(screen.getByText('Salaire')).toBeInTheDocument();
      expect(screen.getByText('À propos du poste')).toBeInTheDocument();
      expect(screen.getByText("À propos de l'entreprise")).toBeInTheDocument();
    });
  });

  it('affiche la section À propos du poste', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(mockOffer.description!)).toBeInTheDocument();
    });
  });

  it("affiche la section À propos de l'entreprise", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(mockOffer.company.description!)).toBeInTheDocument();
    });
  });

  it('affiche les boutons Passer et Liker', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Liker' })).toBeInTheDocument();
    });
  });

  it('déclenche onPass au clic sur Passer', async () => {
    const user = userEvent.setup();
    const onPass = vi.fn();
    renderPage({ onPass });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('déclenche onLike au clic sur Liker', async () => {
    const user = userEvent.setup();
    const onMatch = vi.fn();
    renderPage({ onMatch });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Liker' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Liker' }));
    await waitFor(() =>
      expect(onMatch).toHaveBeenCalledExactlyOnceWith({
        name: mockOffer.company.name,
        avatarUrl: '/api/files/companies/1/logo/acme.png',
      }),
    );
  });

  it('déclenche onBack au clic sur le bouton fermer', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderPage({ onBack });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('affiche l’état liké et non plus Passer / Liker', async () => {
    vi.mocked(offerControllerFindOneById).mockResolvedValue(offerSeenBy({ liked: true }));
    renderPage();

    expect(await screen.findByText('Tu as liké cette offre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer mon like' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liker' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Passer' })).not.toBeInTheDocument();
  });

  it('retire le like puis revient à l’écran précédent', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    vi.mocked(offerControllerFindOneById).mockResolvedValue(offerSeenBy({ liked: true }));
    renderPage({ onBack });

    await user.click(await screen.findByRole('button', { name: 'Retirer mon like' }));

    await waitFor(() => expect(offerControllerUnlike).toHaveBeenCalledExactlyOnceWith(1));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  /**
   * Le cas arrive pour de vrai : le recruteur like au moment où le candidat
   * retire le sien. Le serveur dit pourquoi, et il le dit mieux que nous.
   */
  it('affiche le motif du serveur quand un match interdit le retrait', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    vi.mocked(offerControllerFindOneById).mockResolvedValue(offerSeenBy({ liked: true }));
    vi.mocked(offerControllerUnlike).mockRejectedValue(apiError(409, MATCH_CONFLICT));
    renderPage({ onBack });

    await user.click(await screen.findByRole('button', { name: 'Retirer mon like' }));

    expect(await screen.findByText(MATCH_CONFLICT)).toBeVisible();
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retirer mon like' })).toBeEnabled();
  });

  it('affiche l’état passé en laissant la possibilité de liker', async () => {
    const user = userEvent.setup();
    vi.mocked(offerControllerFindOneById).mockResolvedValue(offerSeenBy({ passed: true }));
    renderPage();

    expect(await screen.findByText('Tu as passé cette offre')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Passer' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Liker' }));

    await waitFor(() => expect(offerControllerLike).toHaveBeenCalledExactlyOnceWith(1));
  });

  // Parcours feed : l'offre n'a été ni likée ni passée, l'écran ne change pas.
  it('garde Passer / Liker quand l’offre n’a été ni likée ni passée', async () => {
    vi.mocked(offerControllerFindOneById).mockResolvedValue(
      offerSeenBy({ liked: false, passed: false }),
    );
    renderPage();

    expect(await screen.findByRole('button', { name: 'Passer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liker' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer mon like' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tu as liké cette offre')).not.toBeInTheDocument();
  });

  // Les deux clés sont absentes pour un recruteur : aucun état de candidature
  // ne doit s'afficher, et surtout pas le retrait de like.
  it('n’affiche aucun état de candidature quand les clés sont absentes', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 2, name: mockOffer.title });

    expect(screen.queryByRole('button', { name: 'Retirer mon like' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tu as liké cette offre')).not.toBeInTheDocument();
    expect(screen.queryByText('Tu as passé cette offre')).not.toBeInTheDocument();
  });

  it('affiche un message de chargement puis le contenu', async () => {
    renderPage();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: mockOffer.title })).toBeInTheDocument();
    });
  });

  it("affiche une erreur si l'offre n'existe pas", async () => {
    vi.mocked(offerControllerFindOneById).mockRejectedValue(new Error('Not found'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Offre introuvable.')).toBeInTheDocument();
    });
  });
});
