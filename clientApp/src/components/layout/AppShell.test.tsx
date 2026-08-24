import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/features/auth/auth-context';
import { ROLE_THEMES } from '@/lib/roleTheme';
import { AppShell } from './AppShell';

type UserType = 'candidate' | 'recruiter';

const callbacks = () => ({ login: vi.fn(), signup: vi.fn(), logout: vi.fn() });

/**
 * The session is injected through the context rather than `AuthProvider`: the
 * shell only reads status and role, and going through the provider would mean
 * faking the boot refresh round-trip on every case below.
 */
const session = (userType: UserType): AuthContextValue => ({
  status: 'authenticated',
  user: { id: 1, email: 'sacha@rekr.fr', role: 'user', userType, isActive: true },
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

const paletteScope = () => screen.getByRole('main').closest('[data-role]');

// A layout route mounts before its child gets a say, so the guards carried by
// the child routes cannot keep the chrome off the screen. Unguarded, the shell
// paints a complete, clickable frame — role label, palette, links — for the
// whole boot refresh, showing a recruiter the candidate identity until the
// session lands. Hence the same guard on the layout itself.
describe('AppShell, session absente', () => {
  it('tient la mise en page sans rien dire de la session en cours de vérification', () => {
    const { container } = renderWith(noSession('loading'));

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre session');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mon profil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByText('contenu')).not.toBeInTheDocument();
    // The palette is what leaked before: the skeleton must not pick a side.
    expect(container.querySelector('[data-role]')).toBeNull();
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

  it('monte les deux chromes du shell', () => {
    renderShell('recruiter');

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navigation de la barre supérieure' }),
    ).toBeInTheDocument();
  });

  it('envoie le recruteur sur le feed candidats dans les deux chromes', () => {
    renderShell('recruiter');

    const feedLinks = screen.getAllByRole('link', { name: 'Feed' });

    expect(feedLinks).toHaveLength(2);
    for (const link of feedLinks) {
      expect(link).toHaveAttribute('href', '/recruteur/candidats');
    }
  });

  it('envoie le candidat sur son feed d’offres dans les deux chromes', () => {
    renderShell('candidate');

    const feedLinks = screen.getAllByRole('link', { name: 'Feed' });

    expect(feedLinks).toHaveLength(2);
    for (const link of feedLinks) {
      expect(link).toHaveAttribute('href', '/candidat/offres');
    }
  });

  it('pointe le bloc profil des deux chromes sur l’écran profil', () => {
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

  // The palette is a set of CSS custom properties redefined under `[data-role=…]`
  // in index.css, and custom properties only cascade to descendants. So the
  // attribute has to sit above the chromes, not on the `main`: scoped to the
  // `main` alone, the sidebar and the header keep the candidate `--line` on a
  // recruiter screen. Asserting the containment, and not just the attribute,
  // is what makes this spec fail if someone pushes it back down.
  it('englobe le chrome dans la portée de la palette du rôle', () => {
    renderShell('recruiter');

    const scope = paletteScope();

    expect(scope).toHaveAttribute('data-role', 'recruiter');
    expect(scope).toContainElement(
      screen.getByRole('navigation', { name: 'Navigation principale' }),
    );
    expect(scope).toContainElement(screen.getByRole('banner'));
    // Vitest loads no CSS: the attribute value is the only guard against the
    // French/English mismatch that once turned every recruiter screen green.
    expect(ROLE_THEMES).toContain('recruiter');
  });

  it('bascule la palette pour un candidat', () => {
    renderShell('candidate');

    expect(paletteScope()).toHaveAttribute('data-role', 'candidate');
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
