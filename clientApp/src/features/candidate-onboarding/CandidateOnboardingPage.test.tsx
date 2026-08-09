import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/api/customFetch';
import {
  candidateProfileControllerCreate,
  candidateProfileControllerUpdate,
  cityControllerSearch,
} from '@/api/generated';
import { CandidateOnboardingPage } from './CandidateOnboardingPage';

vi.mock('@/api/generated', () => ({
  candidateProfileControllerCreate: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  cityControllerSearch: vi.fn(),
}));

const createProfile = vi.mocked(candidateProfileControllerCreate);
const updateProfile = vi.mocked(candidateProfileControllerUpdate);
const searchCities = vi.mocked(cityControllerSearch);

const created = { data: undefined, status: 201, headers: new Headers() };
const updated = { data: undefined, status: 200, headers: new Headers() };

const profileConflict = new ApiError({
  status: 409,
  statusText: 'Conflict',
  url: '/api/candidate-profiles',
  data: { message: 'Candidate profile already exists' },
});

type User = ReturnType<typeof userEvent.setup>;

const submit = (user: User, label = 'Continuer') =>
  user.click(screen.getByRole('button', { name: label }));

const fillIdentity = async (user: User) => {
  await user.type(screen.getByLabelText('Prénom'), 'Ada');
  await user.type(screen.getByLabelText('Nom'), 'Lovelace');
  await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
  await user.click(await screen.findByRole('option', { name: 'Lyon (69001)' }));
  await submit(user);
};

const fillProject = async (user: User) => {
  await user.type(screen.getByLabelText('Poste recherché'), 'Développeuse Front React');
  await user.click(screen.getByRole('checkbox', { name: 'CDI' }));
  await user.click(screen.getByRole('radio', { name: 'Confirmé' }));
  await user.click(screen.getByRole('radio', { name: 'Immédiate' }));
  await submit(user);
};

const fillPreferences = async (user: User) => {
  await user.click(screen.getByRole('radio', { name: 'Hybride' }));
  await user.click(screen.getByRole('radio', { name: 'Toute la France' }));
  await submit(user);
};

const fillShowcase = async (user: User) => {
  await user.type(screen.getByLabelText('Compétences'), 'React{Enter}');
  await user.type(screen.getByRole('textbox', { name: 'À propos de moi' }), 'Je construis le web.');
};

const publishAndSettle = async (user: User, onCompleted: () => void) => {
  await submit(user, 'Publier mon profil');
  await waitFor(() => expect(onCompleted).toHaveBeenCalled());
};

const completeWizard = async (user: User) => {
  await fillIdentity(user);
  await fillProject(user);
  await fillPreferences(user);
  await fillShowcase(user);
};

describe('CandidateOnboardingPage', () => {
  beforeEach(() => {
    // `restoreMocks` only covers spies; the `vi.fn()`s from the module factory
    // are created once and would carry their call counts across tests.
    vi.clearAllMocks();
    sessionStorage.clear();
    createProfile.mockResolvedValue(
      created as Awaited<ReturnType<typeof candidateProfileControllerCreate>>,
    );
    updateProfile.mockResolvedValue(
      updated as Awaited<ReturnType<typeof candidateProfileControllerUpdate>>,
    );
    searchCities.mockResolvedValue({
      data: [{ name: 'Lyon', postalCode: '69001', latitude: 45.758, longitude: 4.835 }],
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof cityControllerSearch>>);
  });

  it('ouvre sur la première étape et annonce la progression', () => {
    render(<CandidateOnboardingPage userId={1} />);

    expect(screen.getByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.getByText('Étape 1 sur 4')).toBeInTheDocument();
  });

  it('applique le thème candidat', () => {
    render(<CandidateOnboardingPage userId={1} />);

    expect(screen.getByRole('main')).toHaveAttribute('data-role', 'candidate');
  });

  it('avance d’étape en étape jusqu’à la vitrine', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CandidateOnboardingPage userId={1} />);

    await fillIdentity(user);
    expect(screen.getByRole('heading', { name: 'Mon projet' })).toBeInTheDocument();

    await fillProject(user);
    expect(screen.getByRole('heading', { name: 'Préférences & mobilité' })).toBeInTheDocument();

    await fillPreferences(user);
    expect(screen.getByRole('heading', { name: 'Compétences & vitrine' })).toBeInTheDocument();
    expect(screen.getByText('Étape 4 sur 4')).toBeInTheDocument();
  });

  it('bloque l’étape et désigne le champ manquant', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CandidateOnboardingPage userId={1} />);

    await submit(user);

    expect(screen.getByRole('alert')).toHaveTextContent('Renseignez votre prénom.');
    expect(screen.getByLabelText('Prénom')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
  });

  it('revient à l’étape précédente sans perdre la saisie', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CandidateOnboardingPage userId={1} />);

    await fillIdentity(user);
    await user.click(screen.getAllByRole('button', { name: 'Retour' })[0]);

    expect(screen.getByLabelText('Prénom')).toHaveValue('Ada');
  });

  it('publie le profil complet et notifie la fin du parcours', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    render(<CandidateOnboardingPage userId={1} onCompleted={onCompleted} />);

    await completeWizard(user);
    await publishAndSettle(user, onCompleted);

    expect(createProfile).toHaveBeenCalledTimes(1);
    expect(createProfile).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'Lyon',
      postalCode: '69001',
      desiredJobTitle: 'Développeuse Front React',
      contractTypes: ['CDI'],
      experienceLevel: 'CONFIRME',
      availability: 'IMMEDIATE',
      remotePolicy: 'HYBRID',
      mobilityNationwide: true,
      skills: ['React'],
      bio: 'Je construis le web.',
    });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  // A profile left behind by an earlier attempt makes the create answer 409.
  // Treating that as a plain success would drop everything typed since.
  it('rejoue la saisie en mise à jour quand le profil existe déjà', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    createProfile.mockRejectedValue(profileConflict);
    render(<CandidateOnboardingPage userId={1} onCompleted={onCompleted} />);

    await completeWizard(user);
    await publishAndSettle(user, onCompleted);

    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ada' }));
  });

  it('signale l’échec de publication sans quitter la dernière étape', async () => {
    const user = userEvent.setup({ delay: null });
    createProfile.mockRejectedValue(new Error('Server error'));
    render(<CandidateOnboardingPage userId={1} />);

    await completeWizard(user);
    await submit(user, 'Publier mon profil');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de publier votre profil. Réessayez dans un instant.',
    );
    expect(screen.getByRole('heading', { name: 'Compétences & vitrine' })).toBeInTheDocument();
  });

  it('invite à se reconnecter quand la session a expiré', async () => {
    const user = userEvent.setup({ delay: null });
    createProfile.mockRejectedValue(
      new ApiError({
        status: 401,
        statusText: 'Unauthorized',
        url: '/api/candidate-profiles',
        data: {},
      }),
    );
    render(<CandidateOnboardingPage userId={1} />);

    await completeWizard(user);
    await submit(user, 'Publier mon profil');

    expect(await screen.findByRole('alert')).toHaveTextContent('Votre session a expiré.');
  });

  it('restaure la saisie après un remontage de la page', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<CandidateOnboardingPage userId={1} />);

    await user.type(screen.getByLabelText('Prénom'), 'Ada');
    unmount();

    render(<CandidateOnboardingPage userId={1} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('Ada');
  });

  it('oublie le brouillon une fois le profil publié', async () => {
    const user = userEvent.setup({ delay: null });
    const onCompleted = vi.fn();
    const { unmount } = render(<CandidateOnboardingPage userId={1} onCompleted={onCompleted} />);

    await completeWizard(user);
    await publishAndSettle(user, onCompleted);
    unmount();

    render(<CandidateOnboardingPage userId={1} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('');
  });

  it('garde le brouillon quand la publication échoue', async () => {
    const user = userEvent.setup({ delay: null });
    createProfile.mockRejectedValue(new Error('Server error'));
    const { unmount } = render(<CandidateOnboardingPage userId={1} />);

    await completeWizard(user);
    await submit(user, 'Publier mon profil');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    unmount();

    render(<CandidateOnboardingPage userId={1} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('Ada');
  });

  // Two candidates can share a tab; neither may inherit the other's draft.
  it('ne restaure pas le brouillon d’un autre utilisateur', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<CandidateOnboardingPage userId={1} />);

    await user.type(screen.getByLabelText('Prénom'), 'Ada');
    unmount();

    render(<CandidateOnboardingPage userId={2} />);

    expect(screen.getByLabelText('Prénom')).toHaveValue('');
  });
});
