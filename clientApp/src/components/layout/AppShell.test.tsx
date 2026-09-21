import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/features/auth/auth-context';
import { AppShell } from './AppShell';

type UserType = 'candidate' | 'recruiter';

const callbacks = () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  markProfileCompleted: vi.fn(),
});

/**
 * The session is injected through the context rather than `AuthProvider`: the
 * shell only reads status and role, and going through the provider would mean
 * faking the boot refresh round-trip on every case below.
 */
const session = (userType: UserType): AuthContextValue => ({
  status: 'authenticated',
  user: {
    id: 1,
    email: 'sacha@rekr.fr',
    role: 'user',
    userType,
    isActive: true,
    hasProfile: true,
  },
  ...callbacks(),
});

const noSession = (status: AuthStatus): AuthContextValue => ({
  status,
  user: null,
  ...callbacks(),
});

const renderWith = (value: AuthContextValue) => {
  const router = createMemoryRouter(
    [
      { element: <AppShell />, children: [{ path: '/', element: <p>contenu</p> }] },
      { path: '/connexion', element: <h1>Connexion</h1> },
    ],
    { initialEntries: ['/'] },
  );

  const view = render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );

  return { ...view, router };
};

const renderShell = (userType: UserType) => renderWith(session(userType));

const sidebar = () => screen.getByRole('complementary');

const tabBar = () => screen.getByRole('navigation', { name: 'Onglets de navigation' });

// A layout route mounts before its child gets a say, so the guards carried by
// the child routes cannot keep the chrome off the screen. Unguarded, the shell
// paints a complete, clickable frame — role label, links — for the
// whole boot refresh, showing a recruiter the candidate identity until the
// session lands. Hence the same guard on the layout itself.
describe('AppShell, session absente', () => {
  it('tient la mise en page sans rien dire de la session en cours de vérification', () => {
    renderWith(noSession('loading'));

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre session');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mon profil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByText('contenu')).not.toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion sans peindre le chrome', () => {
    const { router } = renderWith(noSession('anonymous'));

    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('contenu')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
  });

  // A status without a user is no session: folding the two into one guard is
  // what lets the chrome read `user.email` without a fallback identity.
  it('traite une session authentifiée sans utilisateur comme une absence de session', () => {
    const { router } = renderWith(noSession('authenticated'));

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
  });
});

describe('AppShell', () => {
  it('rend le contenu de la route enfant dans le landmark principal', () => {
    renderShell('recruiter');

    expect(screen.getByRole('main')).toContainElement(screen.getByText('contenu'));
  });

  // A second `main` would give the page two competing landmarks: this one is
  // observable without CSS, unlike the layout invariants below.
  it('n’expose qu’un seul landmark principal', () => {
    renderShell('recruiter');

    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  /**
   * La déconnexion vit dans le chrome, à côté de l'identité qu'elle termine.
   * Elle attendait au bas de la fiche de compte, après un formulaire qu'il
   * fallait dérouler en entier pour la trouver.
   *
   * Trois paliers, trois porteurs : la barre latérale au-dessus de 1440,
   * l'écran « Mon compte » en dessous de 768 (la barre d'onglets n'a de place
   * que pour les destinations), et l'en-tête entre les deux — c'est la seule
   * largeur que ni l'une ni l'autre ne sert.
   */
  describe('déconnexion', () => {
    it('la propose depuis la barre latérale, à côté du bloc profil', () => {
      renderShell('candidate');

      expect(within(sidebar()).getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
    });

    it('la propose dans l’en-tête, pour la largeur que les deux autres ne servent pas', () => {
      renderShell('candidate');

      expect(
        within(screen.getByRole('banner')).getByRole('button', { name: 'Se déconnecter' }),
      ).toBeInTheDocument();
    });

    // jsdom loads no CSS: the utilities are the only trace of the breakpoint
    // that keeps the header's control off the phone and off the desktop.
    it('réserve celle de l’en-tête à la tablette', () => {
      renderShell('candidate');

      const inHeader = within(screen.getByRole('banner')).getByRole('button', {
        name: 'Se déconnecter',
      });

      expect(inHeader.className).toContain('hidden');
      expect(inHeader.className).toContain('md:flex');
      expect(inHeader.className).toContain('desktop:hidden');
    });

    it('ne l’ajoute pas à la barre d’onglets', () => {
      renderShell('candidate');

      expect(
        within(tabBar()).queryByRole('button', { name: 'Se déconnecter' }),
      ).not.toBeInTheDocument();
    });

    // La chaîne complète : le clic termine la session, et c'est la garde du
    // shell qui renvoie vers la connexion.
    it('termine la session et renvoie vers la connexion', async () => {
      const user = userEvent.setup();
      const logout = vi.fn().mockResolvedValue(undefined);
      const { router } = renderWith({ ...session('candidate'), logout });

      await user.click(within(sidebar()).getByRole('button', { name: 'Se déconnecter' }));

      await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('monte les trois chromes du shell', () => {
    renderShell('recruiter');

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navigation de la barre supérieure' }),
    ).toBeInTheDocument();
    expect(tabBar()).toBeInTheDocument();
  });

  it('ne propose plus de menu burger', () => {
    renderShell('candidate');

    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Le recruteur ne swipe plus de candidats : ses annonces sont son point
  // d'entrée, et le feed ne lui est plus proposé du tout.
  it('ne montre aucun feed au recruteur, dans aucun chrome', () => {
    renderShell('recruiter');

    expect(screen.queryAllByRole('link', { name: 'Offres' })).toEqual([]);
  });

  it('ouvre les matchs au recruteur dans les trois chromes', () => {
    renderShell('recruiter');

    const matchLinks = screen.getAllByRole('link', { name: 'Matchs' });

    expect(matchLinks).toHaveLength(3);
    for (const link of matchLinks) {
      expect(link).toHaveAttribute('href', '/matches');
    }
  });

  it('envoie le candidat sur son feed d’offres dans les trois chromes', () => {
    renderShell('candidate');

    const feedLinks = screen.getAllByRole('link', { name: 'Offres' });

    expect(feedLinks).toHaveLength(3);
    for (const link of feedLinks) {
      expect(link).toHaveAttribute('href', '/candidat/offres');
    }
  });

  // The offers screen is reserved to recruiters, so an entry offered to a
  // candidate would only bounce them back to the home page. The shell is the
  // one place that knows the role, hence the case here rather than in the
  // chromes, which render whatever list they are handed.
  it('ouvre la gestion des offres au recruteur dans les trois chromes', () => {
    renderShell('recruiter');

    const offerLinks = screen.getAllByRole('link', { name: 'Mes offres' });

    expect(offerLinks).toHaveLength(3);
    for (const link of offerLinks) {
      expect(link).toHaveAttribute('href', '/recruteur/offres');
    }
  });

  it('ne propose pas la gestion des offres à un candidat', () => {
    renderShell('candidate');

    expect(screen.queryByRole('link', { name: 'Mes offres' })).not.toBeInTheDocument();
  });

  it('pointe le bloc profil de la barre latérale et de l’en-tête sur l’écran profil', () => {
    renderShell('recruiter');

    const profileLinks = screen.getAllByRole('link', { name: 'Mon profil' });

    expect(profileLinks).toHaveLength(2);
    for (const link of profileLinks) {
      expect(link).toHaveAttribute('href', '/profil');
    }
  });

  it('dérive le nom affiché de l’email et affiche le libellé du rôle', () => {
    renderShell('recruiter');

    const profile = within(sidebar()).getByRole('link', { name: 'Mon profil' });

    expect(profile).toHaveTextContent('sacha');
    expect(profile).toHaveTextContent('Recruteur');
  });

  it('affiche le libellé candidat pour un candidat', () => {
    renderShell('candidate');

    expect(within(sidebar()).getByRole('link', { name: 'Mon profil' })).toHaveTextContent(
      'Candidat',
    );
  });

  // The palette is gone: one accent for both roles, so nothing in the shell may
  // still switch on the user type.
  it('ne porte plus de portée de palette par rôle', () => {
    const { container } = renderShell('recruiter');

    expect(container.querySelector('[data-role]')).toBeNull();
  });

  // The phone tab bar is fixed, so it takes no room in the flow: the shell
  // publishes its height as `--tabbar-h` — zero from tablet width, where there
  // is none — and the main column reserves it. The sticky action bars of the
  // pages read the same variable to sit on the bar rather than under it.
  it('réserve la hauteur de la barre d’onglets sous le contenu', () => {
    const { container } = renderShell('candidate');

    const root = container.firstElementChild;

    expect(root?.className).toContain('[--tabbar-h:');
    expect(root?.className).toContain('md:[--tabbar-h:0rem]');
    expect(root).toContainElement(tabBar());
    expect(screen.getByRole('main').className).toContain('var(--tabbar-h)');
  });

  // jsdom loads no CSS, so the ticket's "no horizontal scroll" rule is only
  // observable through the utilities that carry it: the root clips the overflow,
  // and the content column is allowed to shrink below its intrinsic width.
  //
  // `clip` and not `hidden`: `overflow-x: hidden` against a visible `overflow-y`
  // forces the used `overflow-y` to `auto`, which turns the root into a
  // scrollport and makes it — instead of the viewport — the containing block of
  // every `position: sticky` inside. Two shell screens rely on `sticky bottom-0`
  // (the recruiter feed and the candidate detail action bars). `overflow: clip`
  // creates no scroll container, so it holds the ticket's rule without moving
  // that reference.
  it('empêche le débordement horizontal sans créer de conteneur de défilement', () => {
    const { container } = renderShell('recruiter');

    const root = container.firstElementChild;
    const column = screen.getByRole('main').parentElement;

    expect(root).not.toBeNull();
    expect(root?.className).toContain('overflow-x-clip');
    expect(root?.className).not.toContain('overflow-x-hidden');
    expect(column?.className).toContain('min-w-0');
  });
});
