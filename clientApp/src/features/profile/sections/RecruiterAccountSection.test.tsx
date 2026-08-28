import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiError } from '@/api/customFetch';
import {
  cityControllerSearch,
  companyControllerFindMine,
  companyControllerRemoveCoverImage,
  companyControllerRemoveLogo,
  companyControllerReplaceCoverImage,
  companyControllerReplaceLogo,
  companyControllerUpdateMine,
  sectorControllerFindAll,
  type CompanyResponseDto,
} from '@/api/generated';
import { Toaster } from '@/components/ui/sonner';
import {
  FILE_REMOVE_SUCCESS,
  FILE_REPLACE_SUCCESS,
  PROFILE_UPDATE_SUCCESS,
} from '@/features/profile/accountFeedback';
import { RecruiterAccountSection } from './RecruiterAccountSection';

vi.mock('@/api/generated', () => ({
  companyControllerFindMine: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  companyControllerReplaceLogo: vi.fn(),
  companyControllerRemoveLogo: vi.fn(),
  companyControllerReplaceCoverImage: vi.fn(),
  companyControllerRemoveCoverImage: vi.fn(),
  sectorControllerFindAll: vi.fn(),
  cityControllerSearch: vi.fn(),
}));

const findMine = vi.mocked(companyControllerFindMine);
const updateMine = vi.mocked(companyControllerUpdateMine);
const replaceLogo = vi.mocked(companyControllerReplaceLogo);
const removeLogo = vi.mocked(companyControllerRemoveLogo);
const replaceCover = vi.mocked(companyControllerReplaceCoverImage);
const removeCover = vi.mocked(companyControllerRemoveCoverImage);
const findSectors = vi.mocked(sectorControllerFindAll);
const searchCities = vi.mocked(cityControllerSearch);

const company: CompanyResponseDto = {
  id: 7,
  name: 'Studio Lumen',
  logo: 'logo/7/old.png',
  size: 'PME',
  sectorId: 4,
  description: 'On éclaire les scènes.',
  siteUrl: 'https://studiolumen.fr',
  coverImage: 'cover-image/7/old.webp',
  city: 'Lyon',
  postalCode: '69003',
  latitude: '45.7510000',
  longitude: '4.8690000',
  recruiter: { firstName: 'Camille', lastName: 'Martin', jobTitle: 'Responsable RH' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const LOGO_LABEL = 'Logo de la société';
const COVER_LABEL = 'Image de couverture';

/** The write endpoints answer with the updated `company` row, which the
 * generated client types `void`. */
const answer = (data: unknown) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof companyControllerReplaceLogo>
  >;

const apiError = (status: number, message: string) =>
  new ApiError({ status, statusText: '', url: '/api/companies/mine', data: { message } });

const deferred = <T,>() => {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });

  return { promise, settle };
};

const pngOf = (bytes: number, name = 'logo.png') =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

const renderSection = () =>
  render(
    <MemoryRouter>
      <RecruiterAccountSection />
      <Toaster />
    </MemoryRouter>,
  );

/**
 * The screen is folded into sections, and a folded panel is inert — its fields
 * are out of reach for a screen reader and for these specs alike. Most cases
 * are about the form, not about the folding, so they start with everything
 * open; the folding itself is asserted on its own below.
 */
const openEverySection = async (user: ReturnType<typeof userEvent.setup>) => {
  for (const section of screen.getAllByRole('button', { expanded: false })) {
    await user.click(section);
  }
};

const renderLoaded = async () => {
  const rendered = renderSection();
  await screen.findByLabelText('Nom de la société');
  await openEverySection(userEvent.setup());

  return rendered;
};

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Enregistrer' }));

describe('RecruiterAccountSection', () => {
  beforeEach(() => {
    // `restoreMocks` only covers spies; the `vi.fn()`s of the module factory are
    // created once and would carry their calls across tests.
    vi.clearAllMocks();
    findMine.mockResolvedValue(
      answer(company) as unknown as Awaited<ReturnType<typeof companyControllerFindMine>>,
    );
    updateMine.mockResolvedValue(
      answer({ ...company, recruiter: undefined }) as unknown as Awaited<
        ReturnType<typeof companyControllerUpdateMine>
      >,
    );
    replaceLogo.mockResolvedValue(answer({ id: 7, logo: 'logo/7/new.png' }));
    removeLogo.mockResolvedValue(answer({ id: 7, logo: null }));
    replaceCover.mockResolvedValue(answer({ id: 7, coverImage: 'cover-image/7/new.webp' }));
    removeCover.mockResolvedValue(answer({ id: 7, coverImage: null }));
    findSectors.mockResolvedValue({
      data: [
        { id: 4, label: 'Informatique & Numérique' },
        { id: 9, label: 'Bâtiment' },
      ],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof sectorControllerFindAll>>);
    searchCities.mockResolvedValue({
      data: [{ name: 'Nantes', postalCode: '44000', latitude: 47.218, longitude: -1.553 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
  });

  it('annonce le chargement avant d’afficher quoi que ce soit', async () => {
    renderSection();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de vos informations…');

    await screen.findByLabelText('Nom de la société');
  });

  /**
   * Le formulaire faisait onze champs à la suite : il fallait le parcourir en
   * entier pour atteindre le bouton d'enregistrement. Replié, il s'ouvre sur
   * l'identité et laisse le reste de côté.
   */
  it('n’ouvre que la première section à l’arrivée', async () => {
    renderSection();
    await screen.findByLabelText('Nom de la société');

    expect(screen.getByRole('button', { name: 'Mon identité' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Ma société' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('affiche l’identité du recruteur et les informations de la société', async () => {
    await renderLoaded();

    expect(screen.getByLabelText('Prénom')).toHaveValue('Camille');
    expect(screen.getByLabelText('Nom')).toHaveValue('Martin');
    expect(screen.getByLabelText('Poste / fonction')).toHaveValue('Responsable RH');
    expect(screen.getByLabelText('Nom de la société')).toHaveValue('Studio Lumen');
    expect(screen.getByLabelText('Site web (optionnel)')).toHaveValue('https://studiolumen.fr');
    expect(screen.getByRole('combobox', { name: 'Ville' })).toHaveValue('Lyon (69003)');
    expect(screen.getByRole('radio', { name: 'PME' })).toBeChecked();
    await waitFor(() => expect(screen.getByLabelText('Secteur')).toHaveValue('4'));
  });

  // Les avantages se saisissent désormais sur l'offre, où ils diffèrent d'un
  // poste à l'autre. Les laisser ici les rattacherait à la société.
  it('ne propose plus les avantages sur la fiche société', async () => {
    await renderLoaded();

    expect(screen.queryByLabelText('Avantages (optionnel)')).not.toBeInTheDocument();
  });

  // `AppShell` already renders the only `main` of the page.
  it('ne rend pas de région principale concurrente', async () => {
    await renderLoaded();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('affiche les images enregistrées de la société', async () => {
    await renderLoaded();

    expect(screen.getByRole('img', { name: LOGO_LABEL })).toHaveAttribute(
      'src',
      '/api/files/logo/7/old.png',
    );
    expect(screen.getByRole('img', { name: COVER_LABEL })).toHaveAttribute(
      'src',
      '/api/files/cover-image/7/old.webp',
    );
  });

  it('prévient que ces images appartiennent à la société entière', async () => {
    await renderLoaded();

    expect(
      screen.getByText(/partagées avec les autres recruteurs de votre société/),
    ).toBeInTheDocument();
  });

  it('propose de recharger quand le chargement échoue, sans exposer l’erreur technique', async () => {
    const user = userEvent.setup();
    findMine.mockRejectedValueOnce(apiError(500, 'Internal server error'));
    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les informations de votre société.',
    );
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByLabelText('Nom de la société')).toHaveValue('Studio Lumen');
  });

  /** A recruiter who skipped the wizard has no company at all: there is nothing
   * to edit, only a way back to creating it. */
  it('renvoie vers la création de la fiche quand la société n’existe pas encore', async () => {
    findMine.mockRejectedValueOnce(apiError(404, 'Recruiter has no company'));
    renderSection();

    expect(
      await screen.findByText('Vous n’avez pas encore renseigné votre société.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Compléter ma fiche société' })).toHaveAttribute(
      'href',
      '/recruteur/onboarding',
    );
    expect(screen.queryByLabelText('Nom de la société')).not.toBeInTheDocument();
    expect(screen.queryByText('Recruiter has no company')).not.toBeInTheDocument();
  });

  it('enregistre les informations modifiées', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByLabelText('Nom de la société'));
    await user.type(screen.getByLabelText('Nom de la société'), 'Studio Lumen 2');
    await user.clear(screen.getByLabelText('Poste / fonction'));
    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Martinez');
    await save(user);

    await waitFor(() => expect(updateMine).toHaveBeenCalledTimes(1));
    expect(updateMine).toHaveBeenCalledWith({
      firstName: 'Camille',
      lastName: 'Martinez',
      jobTitle: null,
      name: 'Studio Lumen 2',
      sectorId: 4,
      size: 'PME',
      siteUrl: 'https://studiolumen.fr',
      description: 'On éclaire les scènes.',
      city: 'Lyon',
      postalCode: '69003',
    });

    const message = await screen.findByText(PROFILE_UPDATE_SUCCESS);
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
  });

  it('enregistre une nouvelle commune choisie dans la liste', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByRole('combobox', { name: 'Ville' }));
    await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'nantes');
    await user.click(await screen.findByRole('option', { name: 'Nantes (44000)' }));
    await save(user);

    await waitFor(() =>
      expect(updateMine).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Nantes', postalCode: '44000' }),
      ),
    );
  });

  it('envoie chaque champ de la société tel que modifié', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await waitFor(() => expect(screen.getByLabelText('Secteur')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Secteur'), '9');
    await user.click(screen.getByRole('radio', { name: 'TPE' }));
    await user.clear(screen.getByLabelText('Site web (optionnel)'));
    await user.type(screen.getByLabelText('Site web (optionnel)'), 'https://lumen.dev');
    await user.type(screen.getByLabelText('Présentation de la société'), ' Vraiment.');
    await save(user);

    await waitFor(() => expect(updateMine).toHaveBeenCalledTimes(1));
    expect(updateMine).toHaveBeenCalledWith(
      expect.objectContaining({
        sectorId: 9,
        size: 'TPE',
        siteUrl: 'https://lumen.dev',
        description: expect.stringContaining('Vraiment.') as unknown as string,
      }),
    );
  });

  it('désactive l’enregistrement pendant l’envoi', async () => {
    const user = userEvent.setup();
    const pending = deferred<Awaited<ReturnType<typeof companyControllerUpdateMine>>>();
    updateMine.mockReturnValueOnce(pending.promise);
    await renderLoaded();

    await save(user);

    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled();

    pending.settle(answer({ id: 7 }) as never);

    await screen.findByText(PROFILE_UPDATE_SUCCESS);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('refuse un nom de société vide sans appeler l’API', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByLabelText('Nom de la société'));
    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Renseignez le nom de la société.');
    expect(screen.getByLabelText('Nom de la société')).toHaveAttribute('aria-invalid', 'true');
    expect(updateMine).not.toHaveBeenCalled();
  });

  it('refuse un prénom vide sans appeler l’API', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByLabelText('Prénom'));
    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Renseignez votre prénom.');
    expect(updateMine).not.toHaveBeenCalled();
  });

  /** Emptying the pair is not expressible against the API, so it is refused
   * here rather than accepted and ignored. */
  it('refuse d’enregistrer quand la commune a été vidée', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByRole('combobox', { name: 'Ville' }));
    await save(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choisissez votre commune dans la liste.',
    );
    expect(updateMine).not.toHaveBeenCalled();
  });

  it('signale des informations refusées sur un 400', async () => {
    const user = userEvent.setup();
    updateMine.mockRejectedValueOnce(apiError(400, 'property latitude should not exist'));
    await renderLoaded();

    await save(user);

    const message = await screen.findByText(
      'Certaines informations sont refusées. Vérifiez les champs du formulaire.',
    );
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'error');
    expect(screen.queryByText('property latitude should not exist')).not.toBeInTheDocument();
  });

  it('invite à recharger sur un 404', async () => {
    const user = userEvent.setup();
    updateMine.mockRejectedValueOnce(apiError(404, 'Recruiter has no company'));
    await renderLoaded();

    await save(user);

    expect(
      await screen.findByText('Cette fiche n’existe plus. Rechargez la page avant de réessayer.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Recruiter has no company')).not.toBeInTheDocument();
  });

  it('reste générique sur un 500', async () => {
    const user = userEvent.setup();
    updateMine.mockRejectedValueOnce(apiError(500, 'Internal server error'));
    await renderLoaded();

    await save(user);

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez dans un instant.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
  });

  it('signale une panne de connexion quand la requête n’aboutit pas', async () => {
    const user = userEvent.setup();
    updateMine.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await renderLoaded();

    await save(user);

    expect(
      await screen.findByText(
        'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.',
      ),
    ).toBeInTheDocument();
  });

  it('remplace le logo et adopte la clé renvoyée', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.upload(screen.getByLabelText(LOGO_LABEL), pngOf(64));

    expect(replaceLogo).toHaveBeenCalledTimes(1);
    expect(replaceLogo).toHaveBeenCalledWith({ file: expect.any(File) });
    await waitFor(() =>
      expect(screen.getByRole('img', { name: LOGO_LABEL })).toHaveAttribute(
        'src',
        '/api/files/logo/7/new.png',
      ),
    );
    const message = await screen.findByText(FILE_REPLACE_SUCCESS);
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
  });

  it('supprime le logo', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: `Supprimer ${LOGO_LABEL}` }));

    expect(removeLogo).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: LOGO_LABEL })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(FILE_REMOVE_SUCCESS)).toBeInTheDocument();
  });

  it('remplace l’image de couverture et adopte la clé renvoyée', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.upload(screen.getByLabelText(COVER_LABEL), pngOf(64, 'cover.png'));

    expect(replaceCover).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole('img', { name: COVER_LABEL })).toHaveAttribute(
        'src',
        '/api/files/cover-image/7/new.webp',
      ),
    );
  });

  it('supprime l’image de couverture', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: `Supprimer ${COVER_LABEL}` }));

    expect(removeCover).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: COVER_LABEL })).not.toBeInTheDocument(),
    );
  });

  /** Two independent slots: sending a logo must not lock the cover image. */
  it('n’occupe que l’emplacement en cours d’envoi', async () => {
    const user = userEvent.setup();
    const pending = deferred<Awaited<ReturnType<typeof companyControllerReplaceLogo>>>();
    replaceLogo.mockReturnValueOnce(pending.promise);
    await renderLoaded();

    await user.upload(screen.getByLabelText(LOGO_LABEL), pngOf(64));

    expect(screen.getByLabelText(LOGO_LABEL)).toBeDisabled();
    expect(screen.getByLabelText(COVER_LABEL)).toBeEnabled();
    expect(screen.getByRole('button', { name: `Supprimer ${COVER_LABEL}` })).toBeEnabled();

    pending.settle(answer({ id: 7, logo: 'logo/7/new.png' }));

    await waitFor(() => expect(screen.getByLabelText(LOGO_LABEL)).toBeEnabled());
  });

  it('explique un contenu de fichier refusé sur un 400', async () => {
    const user = userEvent.setup();
    replaceLogo.mockRejectedValueOnce(apiError(400, 'Unsupported file type'));
    await renderLoaded();

    await user.upload(screen.getByLabelText(LOGO_LABEL), pngOf(64));

    expect(
      await screen.findByText(
        'Ce fichier a été refusé : son contenu ne correspond pas à son format. Réenregistrez-le au bon format, puis réessayez.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unsupported file type')).not.toBeInTheDocument();
  });

  it('signale un fichier trop volumineux sur un 413', async () => {
    const user = userEvent.setup();
    replaceCover.mockRejectedValueOnce(apiError(413, 'Payload Too Large'));
    await renderLoaded();

    await user.upload(screen.getByLabelText(COVER_LABEL), pngOf(64, 'cover.png'));

    expect(
      await screen.findByText(
        'Ce fichier est trop volumineux pour être envoyé. Choisissez-en un plus léger.',
      ),
    ).toBeInTheDocument();
  });

  it('invite à recharger quand la suppression tombe sur un 404', async () => {
    const user = userEvent.setup();
    removeLogo.mockRejectedValueOnce(apiError(404, 'Recruiter has no company'));
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: `Supprimer ${LOGO_LABEL}` }));

    expect(
      await screen.findByText('Cette fiche n’existe plus. Rechargez la page avant de réessayer.'),
    ).toBeInTheDocument();
    // The slot still shows the file the removal failed to delete.
    expect(screen.getByRole('img', { name: LOGO_LABEL })).toBeInTheDocument();
  });

  it('reste générique sur un 500 au remplacement', async () => {
    const user = userEvent.setup();
    replaceLogo.mockRejectedValueOnce(apiError(500, 'Internal server error'));
    await renderLoaded();

    await user.upload(screen.getByLabelText(LOGO_LABEL), pngOf(64));

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez dans un instant.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
  });

  /** The slot refuses an oversized file on its own; nothing must leave. */
  it('n’envoie rien quand le fichier est refusé sur place', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.upload(screen.getByLabelText(LOGO_LABEL), pngOf(3 * 1024 * 1024));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Fichier trop volumineux : 2 Mo maximum.',
    );
    expect(replaceLogo).not.toHaveBeenCalled();
  });

  /** Degradation, not a crash: a body without a readable key leaves the slot
   * empty rather than pointing at the file that has just been deleted. */
  it('vide l’aperçu quand la réponse ne porte aucune clé lisible', async () => {
    const user = userEvent.setup();
    replaceLogo.mockResolvedValueOnce(answer(undefined));
    await renderLoaded();

    await user.upload(screen.getByLabelText(LOGO_LABEL), pngOf(64));

    await waitFor(() =>
      expect(screen.queryByRole('img', { name: LOGO_LABEL })).not.toBeInTheDocument(),
    );
  });
});
