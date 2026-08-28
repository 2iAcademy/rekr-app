import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSections, ProfileSection } from './accordion';

const renderSections = (defaultOpen?: string[]) =>
  render(
    <ProfileSections defaultOpen={defaultOpen}>
      <ProfileSection value="identite" title="Mon identité">
        <p>Prénom et nom</p>
      </ProfileSection>
      <ProfileSection value="projet" title="Mon projet">
        <p>Poste recherché</p>
      </ProfileSection>
    </ProfileSections>,
  );

describe('ProfileSections', () => {
  it('rend un en-tête par section', () => {
    renderSections();

    expect(screen.getByRole('button', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon projet' })).toBeInTheDocument();
  });

  // La première section est ouverte : un écran entièrement replié ne montre
  // rien de ce que l'on vient consulter.
  it('ouvre la première section par défaut', () => {
    renderSections();

    expect(screen.getByRole('button', { name: 'Mon identité' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Mon projet' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('ouvre les sections nommées par l’appelant', () => {
    renderSections(['projet']);

    expect(screen.getByRole('button', { name: 'Mon projet' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('déplie une section au clic', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(screen.getByRole('button', { name: 'Mon projet' }));

    expect(screen.getByRole('button', { name: 'Mon projet' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  /**
   * Plusieurs sections peuvent rester ouvertes : sur un formulaire, replier
   * automatiquement celle que l'on vient de remplir ferait disparaître une
   * saisie en cours.
   */
  it('laisse plusieurs sections ouvertes en même temps', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(screen.getByRole('button', { name: 'Mon projet' }));

    expect(screen.getByRole('button', { name: 'Mon identité' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  // Le contenu reste dans le DOM une fois replié : un champ démonté perdrait sa
  // valeur, et le formulaire enverrait un champ vide à l'enregistrement.
  it('garde le contenu monté quand la section est repliée', () => {
    renderSections();

    expect(screen.getByText('Poste recherché')).toBeInTheDocument();
  });
});
