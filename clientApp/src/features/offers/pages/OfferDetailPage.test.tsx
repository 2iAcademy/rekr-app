import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { OfferDetailPage } from './OfferDetailPage';
import { offerControllerFindOneById } from '@/api/generated';

vi.mock('@/api/generated', () => ({
  offerControllerFindOneById: vi.fn(),
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
  status: 'open',
  company: {
    id: 1,
    name: 'Acme Corp',
    logo: null,
    size: 'PME',
    description:
      'Acme Corp construit des outils SaaS pour PME industrielles. Fondée en 2018, basée à Lyon, 35 personnes.',
    city: 'Lyon',
  },
  offerTags: [
    { tag: { id: 1, label: 'React', category: 'tech' } },
    { tag: { id: 2, label: 'Node', category: 'tech' } },
    { tag: { id: 3, label: 'TypeScript', category: 'tech' } },
  ],
};

const renderPage = (
  props: { onBack?: () => void; onPass?: () => void; onLike?: () => void } = {},
) =>
  render(
    <MemoryRouter initialEntries={['/offres/1']}>
      <Routes>
        <Route path="/offres/:id" element={<OfferDetailPage {...props} />} />
      </Routes>
    </MemoryRouter>,
  );

describe('OfferDetailPage', () => {
  beforeEach(() => {
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
      for (const ot of mockOffer.offerTags) {
        expect(screen.getByText(ot.tag.label)).toBeInTheDocument();
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
    const onLike = vi.fn();
    renderPage({ onLike });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Liker' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Liker' }));
    expect(onLike).toHaveBeenCalledWith({
      name: mockOffer.company.name,
      avatarUrl: mockOffer.company.logo,
    });
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
