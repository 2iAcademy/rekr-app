import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/api/customFetch';
import {
  cityControllerSearch,
  companyControllerCreate,
  companyControllerUpdateMine,
  offerControllerCreate,
  sectorControllerFindAll,
} from '@/api/generated';
import { RecruiterOnboardingPage } from './RecruiterOnboardingPage';

vi.mock('@/api/generated', () => ({
  companyControllerCreate: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  offerControllerCreate: vi.fn(),
  sectorControllerFindAll: vi.fn(),
  cityControllerSearch: vi.fn(),
}));

const createCompany = vi.mocked(companyControllerCreate);
const updateCompany = vi.mocked(companyControllerUpdateMine);
const createOffer = vi.mocked(offerControllerCreate);
const findSectors = vi.mocked(sectorControllerFindAll);
const searchCities = vi.mocked(cityControllerSearch);

const created = { data: undefined, status: 201, headers: new Headers() };
const updated = { data: undefined, status: 200, headers: new Headers() };

const companyConflict = new ApiError({
  status: 409,
  statusText: 'Conflict',
  url: '/api/companies',
  data: { message: 'Recruiter already has a company' },
});

type User = ReturnType<typeof userEvent.setup>;

const submit = (user: User, label = 'Continuer') =>
  user.click(screen.getByRole('button', { name: label }));

const fillIdentity = async (user: User) => {
  await user.type(screen.getByLabelText('Prénom'), 'Julien');
  await user.type(screen.getByLabelText('Nom'), 'Lemaitre');
  await user.type(screen.getByLabelText('Poste / fonction'), 'Responsable RH');
  await submit(user);
};

const pickCity = async (user: User, label: string, option = 'Lyon (69003)') => {
  await user.type(screen.getByRole('combobox', { name: label }), 'lyon');
  await user.click(await screen.findByRole('option', { name: option }));
};

const fillCompany = async (user: User) => {
  await user.type(screen.getByLabelText('Nom de la société'), 'Rekr');
  await waitFor(() => expect(screen.getByLabelText('Secteur')).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Secteur'), '4');
  await user.click(screen.getByRole('radio', { name: 'PME' }));
  await pickCity(user, 'Ville');
  await submit(user);
};

const fillCulture = async (user: User) => {
  await user.type(screen.getByLabelText('Présentation de la société'), 'On construit Rekr.');
  await submit(user);
};

const fillOffer = async (user: User) => {
  await user.type(screen.getByLabelText('Titre du poste'), 'Développeur Front React');
  await user.type(screen.getByLabelText('Missions'), 'Construire le swipe.');
  await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');
  await submit(user);
};

const fillMatching = async (user: User) => {
  await user.click(screen.getByRole('radio', { name: 'CDI' }));
  await user.click(screen.getByRole('radio', { name: 'Confirmé' }));
  await user.click(screen.getByRole('radio', { name: 'Hybride' }));
};

// Publishing chains two requests: assertions on what followed them have to wait
// for the journey to actually report itself finished.
const publishAndSettle = async (user: User, onCompleted: () => void) => {
  await submit(user, 'Publier mon offre');
  await waitFor(() => expect(onCompleted).toHaveBeenCalled());
};

describe('RecruiterOnboardingPage', () => {
  beforeEach(() => {
    // `restoreMocks` only covers spies; the `vi.fn()`s from the module factory
    // are created once and would carry their call counts across tests.
    vi.clearAllMocks();
    sessionStorage.clear();
    createCompany.mockResolvedValue(created as Awaited<ReturnType<typeof companyControllerCreate>>);
    updateCompany.mockResolvedValue(
      updated as Awaited<ReturnType<typeof companyControllerUpdateMine>>,
    );
    createOffer.mockResolvedValue(created as Awaited<ReturnType<typeof offerControllerCreate>>);
    findSectors.mockResolvedValue({
      data: [{ id: 4, label: 'Informatique & Numérique' }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof sectorControllerFindAll>>);
    searchCities.mockResolvedValue({
      data: [{ name: 'Lyon', postalCode: '69003', latitude: 45.751, longitude: 4.869 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
  });

  // Five steps of typing must survive a reload or a failed publish.
  it('restaure la saisie après un remontage de la page', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<RecruiterOnboardingPage userId={1} />);

    await user.type(screen.getByLabelText('Prénom'), 'Julien');
    await user.type(screen.getByLabelText('Nom'), 'Lemaitre');
    unmount();

    render(<RecruiterOnboardingPage userId={1} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('Julien');
    expect(screen.getByLabelText('Nom')).toHaveValue('Lemaitre');
  });

  it('oublie le brouillon une fois l’offre publiée', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    const { unmount } = render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await publishAndSettle(user, onCompleted);
    unmount();

    render(<RecruiterOnboardingPage userId={1} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('');
  });

  it('garde le brouillon quand la publication échoue', async () => {
    const user = userEvent.setup({ delay: null });
    createCompany.mockRejectedValue(new Error('Server error'));
    const { unmount } = render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await submit(user, 'Publier mon offre');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    unmount();

    render(<RecruiterOnboardingPage userId={1} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('Julien');
  });

  it('ouvre le parcours sur l’étape d’identité', () => {
    render(<RecruiterOnboardingPage userId={1} />);

    expect(screen.getByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.getByText('Étape 1 sur 5')).toBeInTheDocument();
  });

  it('refuse d’avancer tant que l’étape est incomplète', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await submit(user);

    expect(screen.getByRole('alert')).toHaveTextContent('Renseignez votre prénom.');
    expect(screen.getByText('Étape 1 sur 5')).toBeInTheDocument();
  });

  it('désigne le champ fautif et le relie au message affiché', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await user.type(screen.getByLabelText('Prénom'), 'Julien');
    await user.type(screen.getByLabelText('Nom'), 'Lemaitre');
    await submit(user);

    const culprit = screen.getByLabelText('Poste / fonction');
    expect(culprit).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveAttribute(
      'id',
      culprit.getAttribute('aria-describedby'),
    );
    expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'false');
  });

  it('lève le marquage du champ dès que la saisie reprend', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await submit(user);
    expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Prénom'), 'J');

    expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('avance à l’étape suivante quand l’étape est complète', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);

    expect(screen.getByRole('heading', { name: 'Ma société' })).toBeInTheDocument();
    expect(screen.getByText('Étape 2 sur 5')).toBeInTheDocument();
  });

  it('conserve la saisie en revenant à l’étape précédente', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await user.click(screen.getAllByRole('button', { name: 'Retour' })[0]);

    expect(screen.getByLabelText('Prénom')).toHaveValue('Julien');
  });

  it('reprend la localisation de la société dans la première offre', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);

    expect(screen.getByRole('combobox', { name: 'Ville du poste' })).toHaveValue('Lyon (69003)');
  });

  it('ne réécrase pas une localisation d’offre déjà modifiée', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);

    searchCities.mockResolvedValue({
      data: [{ name: 'Villeurbanne', postalCode: '69100', latitude: 45.766, longitude: 4.879 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
    await user.clear(screen.getByRole('combobox', { name: 'Ville du poste' }));
    await pickCity(user, 'Ville du poste', 'Villeurbanne (69100)');
    await user.click(screen.getAllByRole('button', { name: 'Retour' })[0]);
    await submit(user);

    expect(screen.getByRole('combobox', { name: 'Ville du poste' })).toHaveValue(
      'Villeurbanne (69100)',
    );
  });

  it('propose de publier l’offre à la dernière étape', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);

    expect(screen.getByRole('button', { name: 'Publier mon offre' })).toBeInTheDocument();
  });

  it('crée la société puis publie l’offre, et notifie la fin du parcours', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await publishAndSettle(user, onCompleted);

    expect(createCompany).toHaveBeenCalledWith({
      firstName: 'Julien',
      lastName: 'Lemaitre',
      jobTitle: 'Responsable RH',
      name: 'Rekr',
      sectorId: 4,
      size: 'PME',
      city: 'Lyon',
      postalCode: '69003',
      description: 'On construit Rekr.',
    });
    expect(createOffer).toHaveBeenCalledWith({
      title: 'Développeur Front React',
      description: 'Construire le swipe.',
      city: 'Lyon',
      postalCode: '69003',
      skills: ['React'],
      contractType: 'CDI',
      minExperienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      status: 'open',
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('ne publie pas l’offre quand la création de la société échoue', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    createCompany.mockRejectedValue(new Error('Conflict'));
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await submit(user, 'Publier mon offre');

    expect(createOffer).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de publier votre profil. Réessayez dans un instant.',
    );
  });

  it('signale l’échec de publication de l’offre', async () => {
    const user = userEvent.setup({ delay: null });
    createOffer.mockRejectedValue(new Error('Bad Request'));
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await submit(user, 'Publier mon offre');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de publier votre profil. Réessayez dans un instant.',
    );
  });

  it('aboutit à la seconde tentative après un échec d’offre', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    createOffer.mockRejectedValueOnce(new Error('Server error'));
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await submit(user, 'Publier mon offre');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    createCompany.mockRejectedValue(companyConflict);
    await publishAndSettle(user, onCompleted);

    expect(createOffer).toHaveBeenCalledTimes(2);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  // A recruiter whose company already exists — because a previous offer call
  // failed and the page was reloaded, or because they walked the journey twice —
  // must still be able to publish. Replaying the company call is expected here,
  // and its 409 is the state we asked for, not a failure.
  it('publie l’offre quand la société existe déjà côté serveur', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    createCompany.mockRejectedValue(companyConflict);
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await publishAndSettle(user, onCompleted);

    expect(createOffer).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // The 409 says the profile exists, not that the form was pointless: without
  // this replay the second run publishes an offer and drops every company field
  // the recruiter just typed, while showing them a success.
  it('rejoue la saisie en mise à jour quand la société existe déjà', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    createCompany.mockRejectedValue(companyConflict);
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await publishAndSettle(user, onCompleted);

    expect(updateCompany).toHaveBeenCalledTimes(1);
    expect(updateCompany).toHaveBeenCalledWith({
      firstName: 'Julien',
      lastName: 'Lemaitre',
      jobTitle: 'Responsable RH',
      name: 'Rekr',
      sectorId: 4,
      size: 'PME',
      city: 'Lyon',
      postalCode: '69003',
      description: 'On construit Rekr.',
    });
  });

  it('ne tente aucune mise à jour quand la société vient d’être créée', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await publishAndSettle(user, onCompleted);

    expect(updateCompany).not.toHaveBeenCalled();
  });

  // The dead end this replaces: company created, offer failed, recruiter
  // reloads. `companyCreated` was React state, so it came back false.
  it('publie l’offre après un rechargement suivant un échec d’offre', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    createOffer.mockRejectedValueOnce(new Error('Server error'));
    const { unmount } = render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await submit(user, 'Publier mon offre');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    unmount();

    createCompany.mockRejectedValue(companyConflict);
    render(<RecruiterOnboardingPage userId={1} onCompleted={onCompleted} />);
    for (let step = 0; step < 4; step += 1) {
      await submit(user);
    }
    await publishAndSettle(user, onCompleted);

    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('retient une compétence saisie sans validation par Entrée', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await user.type(screen.getByLabelText('Titre du poste'), 'Développeur Front React');
    await user.type(screen.getByLabelText('Missions'), 'Construire le swipe.');
    await user.type(screen.getByLabelText('Compétences recherchées'), 'React');
    await submit(user);

    expect(screen.getByRole('heading', { name: 'Détails du poste' })).toBeInTheDocument();
  });

  it('exige la localisation du poste', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await user.clear(screen.getByRole('combobox', { name: 'Ville du poste' }));
    await user.type(screen.getByLabelText('Titre du poste'), 'Développeur Front React');
    await user.type(screen.getByLabelText('Missions'), 'Construire le swipe.');
    await user.type(screen.getByLabelText('Compétences recherchées'), 'React{Enter}');
    await submit(user);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choisissez la commune du poste dans la liste.',
    );
  });

  it('refuse de publier une fourchette de salaire incohérente', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterOnboardingPage userId={1} />);

    await fillIdentity(user);
    await fillCompany(user);
    await fillCulture(user);
    await fillOffer(user);
    await fillMatching(user);
    await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '55000');
    await user.type(screen.getByLabelText('Salaire maximum (€ brut / an)'), '45000');
    await submit(user, 'Publier mon offre');

    expect(createCompany).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Le salaire maximum ne peut pas être inférieur au minimum.',
    );
  });
});
