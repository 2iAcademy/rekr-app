import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiError } from '@/api/customFetch';
import {
  cityControllerSearch,
  offerControllerCreate,
  offerControllerFindOneById,
  offerControllerUpdate,
  type OfferDetailDto,
} from '@/api/generated';
import { Toaster } from '@/components/ui/sonner';
import {
  NO_COMPANY,
  OFFER_CREATE_SUCCESS,
  OFFER_GONE,
  OFFER_UPDATE_SUCCESS,
  OfferFormPage,
} from './OfferFormPage';

vi.mock('@/api/generated', () => ({
  offerControllerCreate: vi.fn(),
  offerControllerUpdate: vi.fn(),
  offerControllerFindOneById: vi.fn(),
  cityControllerSearch: vi.fn(),
}));

const create = vi.mocked(offerControllerCreate);
const update = vi.mocked(offerControllerUpdate);
const findOne = vi.mocked(offerControllerFindOneById);
const searchCities = vi.mocked(cityControllerSearch);

const answer = (data: unknown) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof offerControllerFindOneById>
  >;

const apiError = (status: number) =>
  new ApiError({ status, statusText: '', url: '/api/offers', data: { message: 'nope' } });

const offer: OfferDetailDto = {
  id: 12,
  title: 'Développeuse Front',
  description: 'Vous construirez le design system.',
  city: 'Lyon',
  postalCode: '69003',
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: 45000,
  salaryMax: 55000,
  status: 'draft',
  createdAt: '2026-01-01T00:00:00.000Z',
  company: {
    id: 7,
    name: 'Studio Lumen',
    logo: null,
    size: 'PME',
    description: null,
    city: 'Lyon',
  },
  tags: [{ label: 'React', category: 'skill' }],
};

/**
 * The list route is mounted as a probe: it is the destination the page navigates
 * to on success, and this test file must not depend on the real routing table.
 */
const LIST_MARKER = 'Liste des offres';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recruteur/offres" element={<p>{LIST_MARKER}</p>} />
        <Route path="/recruteur/offres/nouvelle" element={<OfferFormPage />} />
        <Route path="/recruteur/offres/:id/edition" element={<OfferFormPage />} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );

const renderCreation = () => renderAt('/recruteur/offres/nouvelle');

const renderEdition = async () => {
  const rendered = renderAt('/recruteur/offres/12/edition');
  await screen.findByRole('textbox', { name: 'Titre du poste' });

  return rendered;
};

const deferred = <T,>() => {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });

  return { promise, settle };
};

describe('OfferFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOne.mockResolvedValue(answer(offer));
    create.mockResolvedValue(answer({ ...offer, id: 30 }) as never);
    update.mockResolvedValue(answer(offer) as never);
    searchCities.mockResolvedValue(answer([]) as never);
  });

  describe('création', () => {
    it('ouvre un formulaire vierge sans charger d’offre', () => {
      renderCreation();

      expect(screen.getByRole('textbox', { name: 'Titre du poste' })).toHaveValue('');
      expect(screen.getByRole('radio', { name: 'Brouillon' })).toBeChecked();
      expect(findOne).not.toHaveBeenCalled();
    });

    it('annonce qu’il s’agit d’une nouvelle offre', () => {
      renderCreation();

      expect(screen.getByRole('heading', { name: 'Nouvelle offre' })).toBeInTheDocument();
    });

    it('refuse d’envoyer un formulaire incomplet et pointe le premier champ fautif', async () => {
      const user = userEvent.setup();
      renderCreation();

      await user.click(screen.getByRole('button', { name: 'Créer l’offre' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Renseignez le titre du poste.');
      expect(create).not.toHaveBeenCalled();
    });

    it('crée l’offre puis revient à la liste', async () => {
      const user = userEvent.setup();
      searchCities.mockResolvedValue(
        answer([{ name: 'Lyon', postalCode: '69003', latitude: 45.75, longitude: 4.86 }]) as never,
      );
      renderCreation();

      await user.type(screen.getByRole('textbox', { name: 'Titre du poste' }), 'Développeuse');
      await user.type(screen.getByLabelText('Missions'), 'Construire le design system.');
      await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');
      await user.type(screen.getByRole('combobox', { name: 'Ville du poste' }), 'Lyon');
      await user.click(await screen.findByRole('option', { name: 'Lyon (69003)' }));
      await user.click(screen.getByRole('radio', { name: 'CDI' }));
      await user.click(screen.getByRole('radio', { name: 'Confirmé' }));
      await user.click(screen.getByRole('radio', { name: 'Hybride' }));
      await user.click(screen.getByRole('radio', { name: 'Publiée' }));
      await user.click(screen.getByRole('button', { name: 'Créer l’offre' }));

      await waitFor(() => {
        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Développeuse',
            city: 'Lyon',
            postalCode: '69003',
            skills: ['React'],
            contractType: 'CDI',
            minExperienceLevel: 'CONFIRME',
            remotePolicy: 'HYBRID',
            status: 'open',
          }),
        );
      });
      expect(await screen.findByText(OFFER_CREATE_SUCCESS)).toBeInTheDocument();
      expect(await screen.findByText(LIST_MARKER)).toBeInTheDocument();
    });

    it('explique qu’une société est requise quand l’API répond 404', async () => {
      const user = userEvent.setup();
      create.mockRejectedValue(apiError(404));
      renderCreation();

      await user.type(screen.getByRole('textbox', { name: 'Titre du poste' }), 'Développeuse');
      await user.type(screen.getByLabelText('Missions'), 'Construire le design system.');
      await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');
      await user.click(screen.getByRole('radio', { name: 'CDI' }));
      await user.click(screen.getByRole('radio', { name: 'Confirmé' }));
      await user.click(screen.getByRole('radio', { name: 'Hybride' }));
      // The commune is the only field left, and it is the one the wizard also
      // demands, so the refusal below has to come from the API and not from us.
      searchCities.mockResolvedValue(
        answer([{ name: 'Lyon', postalCode: '69003', latitude: 45.75, longitude: 4.86 }]) as never,
      );
      await user.type(screen.getByRole('combobox', { name: 'Ville du poste' }), 'Lyon');
      await user.click(await screen.findByRole('option', { name: 'Lyon (69003)' }));
      await user.click(screen.getByRole('button', { name: 'Créer l’offre' }));

      expect(await screen.findByText(NO_COMPANY)).toBeInTheDocument();
      expect(screen.queryByText(OFFER_GONE)).not.toBeInTheDocument();
      expect(screen.queryByText(LIST_MARKER)).not.toBeInTheDocument();
    });
  });

  describe('édition', () => {
    it('annonce le chargement de l’offre', () => {
      findOne.mockReturnValue(deferred<never>().promise);
      renderAt('/recruteur/offres/12/edition');

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('charge l’offre demandée et préremplit le formulaire', async () => {
      await renderEdition();

      expect(findOne).toHaveBeenCalledWith(12);
      expect(screen.getByRole('textbox', { name: 'Titre du poste' })).toHaveValue(
        'Développeuse Front',
      );
      expect(screen.getByRole('combobox', { name: 'Ville du poste' })).toHaveValue('Lyon (69003)');
      expect(screen.getByRole('radio', { name: 'CDI' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Brouillon' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Retirer React' })).toBeInTheDocument();
    });

    it('annonce qu’il s’agit d’une modification', async () => {
      await renderEdition();

      expect(screen.getByRole('heading', { name: 'Modifier l’offre' })).toBeInTheDocument();
    });

    it('enregistre les modifications puis revient à la liste', async () => {
      const user = userEvent.setup();
      await renderEdition();

      await user.click(screen.getByRole('radio', { name: 'Publiée' }));
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => {
        expect(update).toHaveBeenCalledWith(
          12,
          expect.objectContaining({ title: 'Développeuse Front', status: 'open' }),
        );
      });
      expect(await screen.findByText(OFFER_UPDATE_SUCCESS)).toBeInTheDocument();
      expect(await screen.findByText(LIST_MARKER)).toBeInTheDocument();
    });

    it('interdit un second envoi tant que le premier est en vol', async () => {
      const user = userEvent.setup();
      const pending = deferred<never>();
      update.mockReturnValue(pending.promise);
      await renderEdition();

      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByRole('button', { name: 'Enregistrement…' })).toBeDisabled();
    });

    it('garde le formulaire ouvert quand l’enregistrement échoue', async () => {
      const user = userEvent.setup();
      update.mockRejectedValue(apiError(500));
      await renderEdition();

      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByText(/une erreur est survenue/i)).toBeInTheDocument();
      expect(screen.queryByText(LIST_MARKER)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
    });

    it('dit qu’une offre disparue ou étrangère est introuvable, sans distinguer les deux', async () => {
      update.mockRejectedValue(apiError(404));
      const user = userEvent.setup();
      await renderEdition();

      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByText(OFFER_GONE)).toBeInTheDocument();
      expect(screen.queryByText(NO_COMPANY)).not.toBeInTheDocument();
    });
  });

  describe('chargement impossible', () => {
    it('propose de réessayer après un échec technique', async () => {
      const user = userEvent.setup();
      findOne.mockRejectedValueOnce(apiError(500));
      renderAt('/recruteur/offres/12/edition');

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Réessayer' }));

      expect(await screen.findByRole('textbox', { name: 'Titre du poste' })).toHaveValue(
        'Développeuse Front',
      );
    });

    it('affiche un message dédié sur une offre introuvable, sans proposer de réessayer', async () => {
      findOne.mockRejectedValue(apiError(404));
      renderAt('/recruteur/offres/12/edition');

      expect(await screen.findByRole('alert')).toHaveTextContent(/introuvable/i);
      expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    });

    it('ne prétend pas savoir si l’offre a disparu ou appartient à une autre société', async () => {
      findOne.mockRejectedValue(apiError(404));
      renderAt('/recruteur/offres/12/edition');

      const message = (await screen.findByRole('alert')).textContent ?? '';

      expect(message).toMatch(/supprimée/i);
      expect(message).toMatch(/société/i);
    });

    it('refuse un identifiant d’offre qui n’est pas un nombre, sans appeler l’API', async () => {
      renderAt('/recruteur/offres/douze/edition');

      expect(await screen.findByRole('alert')).toHaveTextContent(/introuvable/i);
      expect(findOne).not.toHaveBeenCalled();
    });

    it('laisse revenir à la liste depuis l’écran d’erreur', async () => {
      const user = userEvent.setup();
      findOne.mockRejectedValue(apiError(404));
      renderAt('/recruteur/offres/12/edition');

      await user.click(await screen.findByRole('link', { name: 'Retour à mes offres' }));

      expect(await screen.findByText(LIST_MARKER)).toBeInTheDocument();
    });
  });
});
