import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('navigation onboarding', () => {
  it('affiche le Splash sur /', () => {
    renderAt('/');

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it("navigue du Splash vers l'inscription", async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: 'Créer un compte' }));

    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });

  it('navigue du Splash vers la connexion', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: "J'ai déjà un compte" }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("revient au Splash via le bouton retour de l'inscription", async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it("bascule de l'inscription vers la connexion via le lien", async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.click(screen.getByRole('button', { name: 'Connexion' }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("bascule de la connexion vers l'inscription via le lien", async () => {
    const user = userEvent.setup();
    renderAt('/connexion');

    await user.click(screen.getByRole('button', { name: 'Inscription' }));

    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });

  it('navigue de la connexion vers le mot de passe oublié', async () => {
    const user = userEvent.setup();
    renderAt('/connexion');

    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));

    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument();
  });

  it('revient à la connexion depuis le mot de passe oublié', async () => {
    const user = userEvent.setup();
    renderAt('/mot-de-passe-oublie');

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('redirige toute route inconnue vers le Splash', () => {
    renderAt('/route-inexistante');

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });
});
