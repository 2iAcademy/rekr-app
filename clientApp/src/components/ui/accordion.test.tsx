import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSections, ProfileSection } from './accordion';

/**
 * Le résumé fait partie du nom accessible du bouton, et c'est voulu : un lecteur
 * d'écran entend « Mon projet, Développeuse back-end · CDI, replié » avant de
 * décider s'il déplie. Les sélecteurs visent donc le titre par motif.
 */
const header = (title: string) => screen.getByRole('button', { name: new RegExp(title) });

const renderSections = (defaultOpen: string[] = ['identite'], summaries = true) =>
  render(
    <ProfileSections defaultOpen={defaultOpen}>
      <ProfileSection
        value="identite"
        title="Mon identité"
        summary={summaries ? 'Camille Moreau · Lyon' : undefined}
      >
        <p>Prénom et nom</p>
      </ProfileSection>
      <ProfileSection
        value="projet"
        title="Mon projet"
        summary={summaries ? 'Développeuse back-end · CDI' : undefined}
      >
        <p>Poste recherché</p>
      </ProfileSection>
    </ProfileSections>,
  );

describe('ProfileSections', () => {
  it('rend un en-tête par section', () => {
    renderSections();

    expect(header('Mon identité')).toBeInTheDocument();
    expect(header('Mon projet')).toBeInTheDocument();
  });

  // La première section est ouverte : un écran entièrement replié ne montre
  // rien de ce que l'on vient consulter.
  it('ouvre les sections nommées par défaut', () => {
    renderSections();

    expect(header('Mon identité')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(header('Mon projet')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('ouvre les sections nommées par l’appelant', () => {
    renderSections(['projet']);

    expect(header('Mon projet')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('déplie une section au clic', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(header('Mon projet'));

    expect(header('Mon projet')).toHaveAttribute(
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

    await user.click(header('Mon projet'));

    expect(header('Mon identité')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  /**
   * Le contenu replié quitte le DOM, et c'est voulu : les champs sont contrôlés,
   * leur valeur vit dans l'état du parent. La version qui les gardait montés
   * laissait Base UI figer une hauteur mesurée sur un formulaire encore vide,
   * et le dernier champ de la section se retrouvait rogné.
   */
  it('retire le contenu du DOM quand la section est repliée', () => {
    renderSections();

    expect(screen.queryByText('Poste recherché')).not.toBeInTheDocument();
  });

  it('rend le contenu de la section ouverte', () => {
    renderSections();

    expect(screen.getByText('Prénom et nom')).toBeInTheDocument();
  });

  // Rogner le dernier champ était le défaut de la version précédente : la
  // hauteur du panneau doit suivre son contenu, sans valeur figée.
  it('ne borne pas la hauteur du panneau ouvert', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(header('Mon projet'));
    const panel = screen.getByText('Poste recherché').parentElement;

    expect(panel?.style.height).toBe('');
  });

  it('relie l’en-tête au panneau qu’il déplie', async () => {
    const user = userEvent.setup();
    renderSections();

    const trigger = header('Mon projet');
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-controls');
    expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).not.toBeNull();
  });

  /**
   * Ce qui donne son intérêt au pliage : un en-tête qui ne dit que « Mes
   * préférences » oblige à tout déplier pour trouver la bonne section, et ne
   * dit rien de ce qui est déjà renseigné.
   */
  it('résume la section repliée', () => {
    renderSections();

    expect(screen.getByText('Développeuse back-end · CDI')).toBeInTheDocument();
  });

  it('cache le résumé de la section ouverte, qui montre déjà son contenu', () => {
    renderSections();

    expect(screen.queryByText('Camille Moreau · Lyon')).not.toBeInTheDocument();
  });

  it('annonce une section vide comme restant à compléter', () => {
    renderSections(['identite'], false);

    expect(screen.getByText('À compléter')).toBeInTheDocument();
  });
});
