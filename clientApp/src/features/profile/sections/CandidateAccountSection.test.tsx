import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/api/customFetch';
import {
  candidateProfileControllerFindMine,
  cityControllerSearch,
  candidateProfileControllerRemoveCv,
  candidateProfileControllerRemovePicture,
  candidateProfileControllerReplaceCv,
  candidateProfileControllerReplacePicture,
  candidateProfileControllerUpdate,
  type CandidateProfileResponseDto,
} from '@/api/generated';
import { Toaster } from '@/components/ui/sonner';
import {
  FILE_REMOVE_SUCCESS,
  FILE_REPLACE_SUCCESS,
  PROFILE_UPDATE_SUCCESS,
} from '@/features/profile/accountFeedback';
import { CandidateAccountSection } from './CandidateAccountSection';

vi.mock('@/api/generated', () => ({
  candidateProfileControllerFindMine: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  candidateProfileControllerReplacePicture: vi.fn(),
  candidateProfileControllerRemovePicture: vi.fn(),
  candidateProfileControllerReplaceCv: vi.fn(),
  candidateProfileControllerRemoveCv: vi.fn(),
  // Imported by `CityField`, which the form renders.
  cityControllerSearch: vi.fn(),
}));

const findMine = vi.mocked(candidateProfileControllerFindMine);
const update = vi.mocked(candidateProfileControllerUpdate);
const replacePicture = vi.mocked(candidateProfileControllerReplacePicture);
const removePicture = vi.mocked(candidateProfileControllerRemovePicture);
const replaceCv = vi.mocked(candidateProfileControllerReplaceCv);
const removeCv = vi.mocked(candidateProfileControllerRemoveCv);
const searchCity = vi.mocked(cityControllerSearch);

const PICTURE_LABEL_TEXT = 'Photo de profil';
const PICTURE_KEY = 'candidates/42/picture/before.png';
const CV_KEY = 'candidates/42/cv/before.pdf';

const profile = (
  overrides: Partial<CandidateProfileResponseDto> = {},
): CandidateProfileResponseDto => ({
  id: 7,
  userId: 42,
  firstName: 'Camille',
  lastName: 'Martin',
  picture: PICTURE_KEY,
  bio: 'Dix ans de front.',
  city: 'Lyon',
  postalCode: '69003',
  latitude: '45.7578137',
  longitude: '4.8320114',
  desiredJobTitle: 'Développeuse Front React',
  contractTypes: ['CDI', 'FREELANCE'],
  experienceLevel: 'SENIOR',
  availability: 'WITHIN_DELAY',
  availabilityDelayMonths: 3,
  availabilityDate: null,
  remotePolicy: 'HYBRID',
  mobilityRadiusKm: null,
  mobilityNationwide: true,
  salaryMin: 45000,
  salaryMax: 55000,
  linkedinUrl: 'https://linkedin.com/in/camille-martin',
  cvUrl: CV_KEY,
  skills: ['React', 'TypeScript'],
  languages: ['Anglais'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const answered = <T,>(data: unknown): T =>
  ({ data, status: 200, headers: new Headers() }) as unknown as T;

const found = (dto: CandidateProfileResponseDto) =>
  answered<Awaited<ReturnType<typeof candidateProfileControllerFindMine>>>(dto);

/**
 * The write endpoints answer the updated row. Orval types their response `void`
 * (the Nest handlers carry no `@ApiOkResponse`), so the fixture goes in as the
 * body the server really sends.
 */
const written = (row: Partial<CandidateProfileResponseDto>) =>
  answered<Awaited<ReturnType<typeof candidateProfileControllerReplacePicture>>>(row);

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/candidate-profiles/me', data });

const pending = () => new Promise<never>(() => {});

const renderSection = () =>
  render(
    <>
      <CandidateAccountSection />
      <Toaster />
    </>,
  );

const renderLoaded = async (dto: CandidateProfileResponseDto = profile()) => {
  findMine.mockResolvedValue(found(dto));
  renderSection();

  await screen.findByLabelText('Prénom');
};

const saveButton = () => screen.getByRole('button', { name: 'Enregistrer' });

const pictureFile = () => new File(['binary'], 'photo.png', { type: 'image/png' });
const cvFile = () => new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' });

/**
 * `applyAccept: false`: user-event honours the input's `accept` attribute and
 * would drop the file before `FileField` ever sees it, so the refusal under test
 * — the section not calling the API — would never be reached.
 */
const uploadIgnoringAccept = (element: HTMLElement, file: File) =>
  userEvent.setup({ applyAccept: false }).upload(element, file);

describe('CandidateAccountSection', () => {
  beforeEach(() => {
    // Vitest 4 `restoreMocks` restores spies, not the call history of a
    // `vi.fn()` from a module factory: without this every count is cumulative.
    vi.clearAllMocks();
    findMine.mockResolvedValue(found(profile()));
    update.mockResolvedValue(written(profile()));
    replacePicture.mockResolvedValue(written(profile()));
    removePicture.mockResolvedValue(written(profile({ picture: null })));
    replaceCv.mockResolvedValue(written(profile()));
    removeCv.mockResolvedValue(written(profile({ cvUrl: null })));
    searchCity.mockResolvedValue(
      answered<Awaited<ReturnType<typeof cityControllerSearch>>>([
        { name: 'Bordeaux', postalCode: '33000', latitude: 44.84, longitude: -0.58 },
      ]),
    );
  });

  describe('chargement', () => {
    it('annonce le chargement au lieu d’un écran vide', () => {
      findMine.mockReturnValue(pending());
      renderSection();

      expect(screen.getByRole('status')).toHaveTextContent('Chargement de vos informations');
    });

    it('ne charge le profil qu’une fois', async () => {
      await renderLoaded();

      expect(findMine).toHaveBeenCalledTimes(1);
    });

    it('affiche les informations enregistrées', async () => {
      await renderLoaded();

      expect(screen.getByLabelText('Prénom')).toHaveValue('Camille');
      expect(screen.getByLabelText('Nom')).toHaveValue('Martin');
      expect(screen.getByLabelText('Poste recherché')).toHaveValue('Développeuse Front React');
      expect(screen.getByLabelText('Profil LinkedIn')).toHaveValue(
        'https://linkedin.com/in/camille-martin',
      );
      expect(screen.getByRole('combobox', { name: 'Ville' })).toHaveValue('Lyon (69003)');
      expect(screen.getByRole('checkbox', { name: 'CDI' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'CDD' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Senior' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Hybride' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Toute la France' })).toBeChecked();
      expect(screen.getByLabelText('Salaire minimum (€ brut / an)')).toHaveValue('45000');
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Anglais')).toBeInTheDocument();
    });

    it('affiche le champ conditionnel de la disponibilité choisie', async () => {
      await renderLoaded();

      expect(screen.getByLabelText('Disponible dans (mois)')).toHaveValue('3');
      expect(screen.queryByLabelText('Date de disponibilité')).not.toBeInTheDocument();
    });

    it('invite à compléter son profil quand il n’existe pas encore', async () => {
      findMine.mockRejectedValue(apiError(404, { message: 'Candidate profile not found' }));
      renderSection();

      expect(await screen.findByRole('link', { name: 'Compléter mon profil' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument();
      expect(screen.queryByText('Candidate profile not found')).not.toBeInTheDocument();
    });

    it('signale un chargement impossible sans exposer le message du serveur', async () => {
      findMine.mockRejectedValue(apiError(500, { message: 'Internal server error' }));
      renderSection();

      const alert = await screen.findByRole('alert');

      expect(alert).toHaveTextContent('Impossible de charger vos informations');
      expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument();
    });

    it('signale un chargement impossible quand la requête n’aboutit pas', async () => {
      findMine.mockRejectedValue(new TypeError('Failed to fetch'));
      renderSection();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Impossible de charger vos informations',
      );
    });
  });

  describe('enregistrement', () => {
    it('envoie l’ensemble des champs modifiables', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(saveButton());

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(update).toHaveBeenCalledWith({
        firstName: 'Camille',
        lastName: 'Martin',
        bio: 'Dix ans de front.',
        city: 'Lyon',
        postalCode: '69003',
        desiredJobTitle: 'Développeuse Front React',
        contractTypes: ['CDI', 'FREELANCE'],
        experienceLevel: 'SENIOR',
        availability: 'WITHIN_DELAY',
        availabilityDelayMonths: 3,
        remotePolicy: 'HYBRID',
        mobilityNationwide: true,
        mobilityRadiusKm: null,
        salaryMin: 45000,
        salaryMax: 55000,
        skills: ['React', 'TypeScript'],
        languages: ['Anglais'],
        linkedinUrl: 'https://linkedin.com/in/camille-martin',
      });
    });

    it('envoie le champ modifié', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByLabelText('Poste recherché'));
      await user.type(screen.getByLabelText('Poste recherché'), 'Lead Front');
      await user.click(saveButton());

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ desiredJobTitle: 'Lead Front' }),
      );
    });

    /**
     * The API writes skills and languages as one set: a body carrying only the
     * skills clears the languages.
     */
    it('renvoie les langues quand seules les compétences ont changé', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Retirer React' }));
      await user.click(saveButton());

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ skills: ['TypeScript'], languages: ['Anglais'] }),
      );
    });

    it('renvoie les compétences quand seules les langues ont changé', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Retirer Anglais' }));
      await user.click(saveButton());

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ skills: ['React', 'TypeScript'], languages: [] }),
      );
    });

    it('confirme l’enregistrement par un toast de succès', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(saveButton());

      const message = await screen.findByText(PROFILE_UPDATE_SUCCESS);
      expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
    });

    it('désactive le bouton pendant l’envoi', async () => {
      const user = userEvent.setup();
      update.mockReturnValue(pending());
      await renderLoaded();

      await user.click(saveButton());

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled();
      });
    });

    it('n’enregistre qu’une fois sur deux clics rapprochés', async () => {
      const user = userEvent.setup();
      update.mockReturnValue(pending());
      await renderLoaded();

      await user.click(saveButton());
      await user.click(screen.getByRole('button', { name: 'Enregistrement…' }));

      expect(update).toHaveBeenCalledTimes(1);
    });

    it('refuse d’enregistrer sans prénom et ne contacte pas le serveur', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByLabelText('Prénom'));
      await user.click(saveButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('Votre prénom est obligatoire.');
      expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'true');
      expect(update).not.toHaveBeenCalled();
    });

    it('refuse d’enregistrer sans nom', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByLabelText('Nom'));
      await user.click(saveButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('Votre nom est obligatoire.');
      expect(update).not.toHaveBeenCalled();
    });

    it('annonce des informations refusées sur un 400 sans exposer le détail technique', async () => {
      const user = userEvent.setup();
      update.mockRejectedValue(apiError(400, { message: ['linkedinUrl must be a URL address'] }));
      await renderLoaded();

      await user.click(saveButton());

      const message = await screen.findByText(
        'Certaines informations sont refusées. Vérifiez les champs du formulaire.',
      );
      expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'error');
      expect(screen.queryByText(/must be a URL address/)).not.toBeInTheDocument();
    });

    it('annonce une fiche disparue sur un 404', async () => {
      const user = userEvent.setup();
      update.mockRejectedValue(apiError(404, { message: 'Candidate profile not found' }));
      await renderLoaded();

      await user.click(saveButton());

      expect(await screen.findByText(/Cette fiche n’existe plus/)).toBeInTheDocument();
      expect(screen.queryByText('Candidate profile not found')).not.toBeInTheDocument();
    });

    it('reste générique sur un 500', async () => {
      const user = userEvent.setup();
      update.mockRejectedValue(apiError(500, { message: 'Internal server error' }));
      await renderLoaded();

      await user.click(saveButton());

      expect(
        await screen.findByText('Une erreur est survenue. Réessayez dans un instant.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
    });

    it('signale un serveur injoignable', async () => {
      const user = userEvent.setup();
      update.mockRejectedValue(new TypeError('Failed to fetch'));
      await renderLoaded();

      await user.click(saveButton());

      expect(
        await screen.findByText(
          'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.',
        ),
      ).toBeInTheDocument();
    });

    it('réactive le bouton après un échec, pour laisser réessayer', async () => {
      const user = userEvent.setup();
      update.mockRejectedValue(apiError(500, {}));
      await renderLoaded();

      await user.click(saveButton());

      await waitFor(() => expect(saveButton()).not.toBeDisabled());
    });
  });

  describe('photo de profil', () => {
    it('affiche l’aperçu à partir de la clé de stockage', async () => {
      await renderLoaded();

      expect(screen.getByRole('img', { name: 'Photo de profil' })).toHaveAttribute(
        'src',
        `/api/files/${PICTURE_KEY}`,
      );
    });

    it('remplace la photo et adopte la clé renvoyée', async () => {
      const user = userEvent.setup();
      const file = pictureFile();
      replacePicture.mockResolvedValue(
        written(profile({ picture: 'candidates/42/picture/after.png' })),
      );
      await renderLoaded();

      await user.upload(screen.getByLabelText('Photo de profil'), file);

      await waitFor(() => expect(replacePicture).toHaveBeenCalledWith({ file }));
      expect(await screen.findByText(FILE_REPLACE_SUCCESS)).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Photo de profil' })).toHaveAttribute(
        'src',
        '/api/files/candidates/42/picture/after.png',
      );
    });

    it('supprime la photo et retire son aperçu', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Supprimer Photo de profil' }));

      await waitFor(() => expect(removePicture).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(FILE_REMOVE_SUCCESS)).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Photo de profil' })).not.toBeInTheDocument();
    });

    it('n’offre pas de suppression quand aucune photo n’est enregistrée', async () => {
      await renderLoaded(profile({ picture: null }));

      expect(
        screen.queryByRole('button', { name: 'Supprimer Photo de profil' }),
      ).not.toBeInTheDocument();
    });

    it('refuse un fichier hors format sans appeler l’API', async () => {
      await renderLoaded();

      await uploadIgnoringAccept(
        screen.getByLabelText('Photo de profil'),
        new File(['x'], 'photo.gif', { type: 'image/gif' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent('Format non accepté');
      expect(replacePicture).not.toHaveBeenCalled();
    });

    it('annonce un fichier refusé par le serveur sur un 413', async () => {
      const user = userEvent.setup();
      replacePicture.mockRejectedValue(apiError(413, { message: 'Payload Too Large' }));
      await renderLoaded();

      await user.upload(screen.getByLabelText('Photo de profil'), pictureFile());

      expect(await screen.findByText(/trop volumineux pour être envoyé/)).toBeInTheDocument();
      expect(screen.queryByText('Payload Too Large')).not.toBeInTheDocument();
    });

    it('vide l’emplacement quand la réponse ne porte aucune clé', async () => {
      const user = userEvent.setup();
      replacePicture.mockResolvedValue(written({}));
      await renderLoaded();

      await user.upload(screen.getByLabelText(PICTURE_LABEL_TEXT), pictureFile());

      await waitFor(() => expect(replacePicture).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('img', { name: PICTURE_LABEL_TEXT })).not.toBeInTheDocument();
    });

    it('ne supprime qu’une fois sur deux clics rapprochés', async () => {
      const user = userEvent.setup();
      removePicture.mockReturnValue(pending());
      await renderLoaded();

      const remove = () => screen.getByRole('button', { name: 'Supprimer Photo de profil' });
      await user.click(remove());
      await user.click(remove());

      expect(removePicture).toHaveBeenCalledTimes(1);
    });

    it('annonce une suppression impossible sur un 404', async () => {
      const user = userEvent.setup();
      removePicture.mockRejectedValue(apiError(404, { message: 'Candidate profile not found' }));
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Supprimer Photo de profil' }));

      expect(await screen.findByText(/Cette fiche n’existe plus/)).toBeInTheDocument();
    });
  });

  describe('CV', () => {
    it('annonce le CV enregistré sans en afficher d’aperçu', async () => {
      await renderLoaded();

      expect(screen.getByText('CV enregistré')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'CV' })).not.toBeInTheDocument();
    });

    it('annonce l’absence de CV', async () => {
      await renderLoaded(profile({ cvUrl: null }));

      expect(screen.getByText('Aucun CV enregistré')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Supprimer CV' })).not.toBeInTheDocument();
    });

    it('remplace le CV et adopte la clé renvoyée', async () => {
      const user = userEvent.setup();
      const file = cvFile();
      replaceCv.mockResolvedValue(written(profile({ cvUrl: 'candidates/42/cv/after.pdf' })));
      await renderLoaded(profile({ cvUrl: null }));

      await user.upload(screen.getByLabelText('CV'), file);

      await waitFor(() => expect(replaceCv).toHaveBeenCalledWith({ file }));
      expect(await screen.findByText(FILE_REPLACE_SUCCESS)).toBeInTheDocument();
      expect(screen.getByText('CV enregistré')).toBeInTheDocument();
    });

    it('supprime le CV', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'Supprimer CV' }));

      await waitFor(() => expect(removeCv).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(FILE_REMOVE_SUCCESS)).toBeInTheDocument();
      expect(screen.getByText('Aucun CV enregistré')).toBeInTheDocument();
    });

    it('refuse un fichier qui n’est pas un PDF sans appeler l’API', async () => {
      await renderLoaded();

      await uploadIgnoringAccept(screen.getByLabelText('CV'), pictureFile());

      expect(await screen.findByRole('alert')).toHaveTextContent('Format non accepté');
      expect(replaceCv).not.toHaveBeenCalled();
    });
  });

  describe('emplacements indépendants', () => {
    it('n’immobilise que l’emplacement en cours d’envoi', async () => {
      const user = userEvent.setup();
      replacePicture.mockReturnValue(pending());
      await renderLoaded();

      await user.upload(screen.getByLabelText('Photo de profil'), pictureFile());

      await waitFor(() => {
        expect(screen.getByText('Envoi de la photo…')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Photo de profil')).toBeDisabled();
      expect(screen.getByLabelText('CV')).not.toBeDisabled();
      expect(screen.queryByText('Envoi du CV…')).not.toBeInTheDocument();
    });

    it('n’immobilise pas le formulaire pendant un envoi de fichier', async () => {
      const user = userEvent.setup();
      replacePicture.mockReturnValue(pending());
      await renderLoaded();

      await user.upload(screen.getByLabelText('Photo de profil'), pictureFile());

      await waitFor(() => {
        expect(screen.getByText('Envoi de la photo…')).toBeInTheDocument();
      });
      expect(saveButton()).not.toBeDisabled();
    });
  });

  describe('champs du formulaire', () => {
    const savedPayload = async () => {
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

      return update.mock.calls[0][0];
    };

    it('écrit la commune choisie avec son code postal', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByRole('combobox', { name: 'Ville' }));
      await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'bordeaux');
      await user.click(await screen.findByRole('option', { name: 'Bordeaux (33000)' }));
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({ city: 'Bordeaux', postalCode: '33000' });
    });

    /**
     * Typing in the field clears the selected commune, so this is how a profile
     * loses its address by accident. A commune is mandatory: the save has to be
     * refused rather than storing half an address.
     */
    it('refuse d’enregistrer quand la commune a été vidée', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'x');
      await user.click(saveButton());

      expect(
        await screen.findByText('Choisissez votre commune dans la liste.'),
      ).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    });

    it('modifie les types de contrat retenus', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('checkbox', { name: 'CDI' }));
      await user.click(screen.getByRole('checkbox', { name: 'Alternance' }));
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({ contractTypes: ['ALTERNANCE', 'FREELANCE'] });
    });

    it('modifie le niveau d’expérience et la politique de télétravail', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('radio', { name: 'Expert' }));
      await user.click(screen.getByRole('radio', { name: 'Full remote' }));
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({
        experienceLevel: 'EXPERT',
        remotePolicy: 'FULL_REMOTE',
      });
    });

    it('remplace le délai par une date quand la disponibilité devient datée', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('radio', { name: 'À une date précise' }));
      await user.type(screen.getByLabelText('Date de disponibilité'), '2026-09-01');
      await user.click(saveButton());

      const payload = await savedPayload();
      expect(payload).toMatchObject({
        availability: 'SPECIFIC_DATE',
        availabilityDate: '2026-09-01',
        availabilityDelayMonths: null,
      });
      expect(screen.queryByLabelText('Disponible dans (mois)')).not.toBeInTheDocument();
    });

    it('efface le délai quand la disponibilité devient immédiate', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('radio', { name: 'Immédiate' }));
      await user.click(saveButton());

      const payload = await savedPayload();
      expect(payload).toMatchObject({ availability: 'IMMEDIATE', availabilityDelayMonths: null });
      expect(payload).not.toHaveProperty('availabilityDate');
    });

    it('modifie le délai de disponibilité', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByLabelText('Disponible dans (mois)'));
      await user.type(screen.getByLabelText('Disponible dans (mois)'), '6');
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({ availabilityDelayMonths: 6 });
    });

    it('demande un rayon quand la mobilité devient locale', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('radio', { name: 'Autour de ma ville' }));
      await user.type(screen.getByLabelText('Rayon de mobilité (km)'), '30');
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({
        mobilityNationwide: false,
        mobilityRadiusKm: 30,
      });
    });

    it('modifie la fourchette de salaire', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByLabelText('Salaire minimum (€ brut / an)'));
      await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '50000');
      await user.clear(screen.getByLabelText('Salaire maximum (€ brut / an)'));
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({ salaryMin: 50000, salaryMax: null });
    });

    it('ajoute une compétence et une langue', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.type(screen.getByLabelText('Compétences'), 'GraphQL{Enter}');
      await user.type(screen.getByLabelText('Langues'), 'Espagnol{Enter}');
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({
        skills: ['React', 'TypeScript', 'GraphQL'],
        languages: ['Anglais', 'Espagnol'],
      });
    });

    it('modifie la présentation', async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded(profile({ bio: null }));

      await user.click(screen.getByRole('textbox', { name: 'À propos de moi' }));
      await user.keyboard('Bonjour');
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({ bio: 'Bonjour' });
    });

    it('modifie le lien LinkedIn', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.clear(screen.getByLabelText('Profil LinkedIn'));
      await user.click(saveButton());

      expect(await savedPayload()).toMatchObject({ linkedinUrl: '' });
    });
  });

  it('ne rend aucun main, le shell en fournit déjà un', async () => {
    await renderLoaded();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
