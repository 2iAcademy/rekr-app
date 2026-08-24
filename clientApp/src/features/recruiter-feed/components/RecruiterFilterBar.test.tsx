import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyFeedFilters, type FeedFilters } from '../types';
import { RecruiterFilterBar } from './RecruiterFilterBar';

const renderBar = (
  props: Partial<{
    filters: FeedFilters;
    onChange: (filters: FeedFilters) => void;
    resultCount: number;
  }> = {},
) =>
  render(
    <RecruiterFilterBar filters={emptyFeedFilters} onChange={vi.fn()} resultCount={4} {...props} />,
  );

const RESET = 'Réinitialiser les filtres';
const QUICK_ROW = 'Filtres rapides';

// The disclosure button is named after the state it leads out of, so the query
// has to accept both wordings.
const toggle = () =>
  screen.getByRole('button', { name: /^(?:Plus de filtres|Masquer les filtres)/ });

// Chips are the only buttons carrying a pressed state, which makes them
// identifiable without leaning on a class or a test id.
const chips = () =>
  screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'));

const chipLabels = () => chips().map((button) => button.textContent);

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(toggle());
};

describe('FeedFilterBar', () => {
  it('rend les dix puces sur une seule rangée, dans l’ordre d’affichage', () => {
    renderBar();

    expect(chipLabels()).toEqual([
      'CDI',
      'CDD',
      'Alternance',
      'Stage',
      'Freelance',
      'Intérim',
      'Junior',
      'Confirmé',
      'Senior',
      'Expert',
    ]);
  });

  it('tient les dix puces dans la rangée défilable', () => {
    renderBar();

    const row = screen.getByRole('group', { name: QUICK_ROW });
    const rowChips = chips();

    expect(rowChips).toHaveLength(10);
    rowChips.forEach((chip) => {
      expect(row).toContainElement(chip);
    });
  });

  // The disclosure button used to sit inside the scrollable row, where it
  // covered the last chip and swallowed the swipe.
  it('laisse le bouton de dépliement hors de la rangée défilable', () => {
    renderBar();

    const row = screen.getByRole('group', { name: QUICK_ROW });

    expect(row.contains(toggle())).toBe(false);
  });

  it('retire la rangée défilable quand le panneau est déplié', async () => {
    const user = userEvent.setup();
    renderBar();

    await openPanel(user);

    expect(screen.queryByRole('group', { name: QUICK_ROW })).not.toBeInTheDocument();
  });

  it('n’affiche aucun intitulé de groupe tant que le panneau est replié', () => {
    renderBar();

    expect(screen.queryByRole('group', { name: 'Type de contrat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: "Niveau d'expérience" })).not.toBeInTheDocument();
    expect(screen.queryByText('Type de contrat')).not.toBeInTheDocument();
  });

  it('présente le bouton de divulgation replié par défaut', () => {
    renderBar();

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('déploie les deux groupes nommés au clic sur le bouton de divulgation', async () => {
    const user = userEvent.setup();
    renderBar();

    await openPanel(user);

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Type de contrat' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: "Niveau d'expérience" })).toBeInTheDocument();
  });

  it('désigne le panneau déployé par aria-controls', async () => {
    const user = userEvent.setup();
    renderBar();

    await openPanel(user);

    const panelId = toggle().getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId as string);
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(screen.getByRole('group', { name: 'Type de contrat' }));
  });

  // Two renderings of the same chip would make `getByRole('button', { name: 'CDI' })`
  // ambiguous and read the option twice to a screen reader.
  it('ne rend jamais une puce en double, panneau ouvert', async () => {
    const user = userEvent.setup();
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: ['JUNIOR'] } });

    await openPanel(user);

    expect(chipLabels()).toHaveLength(10);
    expect(new Set(chipLabels()).size).toBe(10);
    expect(screen.getAllByRole('button', { name: 'CDI' })).toHaveLength(1);
  });

  it('replie le panneau au second clic', async () => {
    const user = userEvent.setup();
    renderBar();

    await openPanel(user);
    await openPanel(user);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Type de contrat' })).not.toBeInTheDocument();
    expect(chipLabels()).toHaveLength(10);
  });

  // The icon flips from + to −; the accessible name has to say the same thing.
  it('renomme le bouton « Masquer les filtres » une fois le panneau déplié', async () => {
    const user = userEvent.setup();
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: ['SENIOR'] } });

    await openPanel(user);

    expect(screen.getByRole('button', { name: 'Masquer les filtres' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Plus de filtres/ })).not.toBeInTheDocument();
  });

  it('redonne au bouton son nom replié après refermeture', async () => {
    const user = userEvent.setup();
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: ['SENIOR'] } });

    await openPanel(user);
    await openPanel(user);

    expect(screen.getByRole('button', { name: 'Plus de filtres (2 actifs)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Masquer les filtres' })).not.toBeInTheDocument();
  });

  it('ne signale aucun décompte sur le bouton sans filtre actif', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'Plus de filtres' })).toBeInTheDocument();
  });

  it('annonce sur le bouton le nombre de filtres actifs', () => {
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: ['SENIOR'] } });

    expect(screen.getByRole('button', { name: 'Plus de filtres (2 actifs)' })).toBeInTheDocument();
  });

  it('accorde au singulier le décompte du bouton', () => {
    renderBar({ filters: { contractTypes: [], experienceLevels: ['SENIOR'] } });

    expect(screen.getByRole('button', { name: 'Plus de filtres (1 actif)' })).toBeInTheDocument();
  });

  it('marque comme pressées les seules valeurs retenues', () => {
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: ['SENIOR'] } });

    expect(screen.getByRole('button', { name: 'CDI' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'CDD' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Senior' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('conserve l’état pressé des puces dans le panneau déployé', async () => {
    const user = userEvent.setup();
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: [] } });

    await openPanel(user);

    expect(screen.getByRole('button', { name: 'CDI' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'CDD' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('ajoute une valeur au clic depuis la rangée sans toucher l’autre axe', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: [], experienceLevels: ['JUNIOR'] }, onChange });

    await user.click(screen.getByRole('button', { name: 'Freelance' }));

    expect(onChange).toHaveBeenCalledWith({
      contractTypes: ['FREELANCE'],
      experienceLevels: ['JUNIOR'],
    });
  });

  it('retire une valeur déjà retenue au second clic', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: ['CDI', 'CDD'], experienceLevels: [] }, onChange });

    await user.click(screen.getByRole('button', { name: 'CDI' }));

    expect(onChange).toHaveBeenCalledWith({ contractTypes: ['CDD'], experienceLevels: [] });
  });

  it('remonte les mêmes filtres depuis le panneau déployé', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: [], experienceLevels: [] }, onChange });

    await openPanel(user);
    await user.click(screen.getByRole('button', { name: 'Expert' }));

    expect(onChange).toHaveBeenCalledWith({ contractTypes: [], experienceLevels: ['EXPERT'] });
  });

  // Read back, the selection has to match the order of the chips on screen,
  // not the order the recruiter happened to click them in.
  it('conserve l’ordre d’affichage quel que soit celui des clics', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: ['FREELANCE'], experienceLevels: [] }, onChange });

    await user.click(screen.getByRole('button', { name: 'CDD' }));

    expect(onChange).toHaveBeenCalledWith({
      contractTypes: ['CDD', 'FREELANCE'],
      experienceLevels: [],
    });
  });

  it('ne mute pas les filtres reçus en prop', async () => {
    const user = userEvent.setup();
    const filters: FeedFilters = { contractTypes: ['CDI'], experienceLevels: ['JUNIOR'] };
    renderBar({ filters, onChange: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Stage' }));

    expect(filters).toEqual({ contractTypes: ['CDI'], experienceLevels: ['JUNIOR'] });
  });

  it('garde la réinitialisation hors de la rangée repliée', () => {
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: [] } });

    expect(screen.queryByRole('button', { name: RESET })).not.toBeInTheDocument();
  });

  it('cache la réinitialisation dans le panneau tant qu’aucun filtre n’est actif', async () => {
    const user = userEvent.setup();
    renderBar();

    await openPanel(user);

    expect(screen.queryByRole('button', { name: RESET })).not.toBeInTheDocument();
  });

  it('propose la réinitialisation dès qu’un seul axe est renseigné', async () => {
    const user = userEvent.setup();
    renderBar({ filters: { contractTypes: [], experienceLevels: ['EXPERT'] } });

    await openPanel(user);

    expect(screen.getByRole('button', { name: RESET })).toBeInTheDocument();
  });

  it('vide les deux axes à la réinitialisation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar({ filters: { contractTypes: ['CDI'], experienceLevels: ['EXPERT'] }, onChange });

    await openPanel(user);
    await user.click(screen.getByRole('button', { name: RESET }));

    expect(onChange).toHaveBeenCalledWith({ contractTypes: [], experienceLevels: [] });
  });

  // Kept mounted while the row is collapsed: chips are togglable from the row,
  // so the count has to be announced there too.
  it('annonce le nombre de résultats dans une région live, panneau replié', () => {
    renderBar({ resultCount: 4 });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('4 profils correspondent');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('affiche le décompte dans le panneau déployé', async () => {
    const user = userEvent.setup();
    renderBar({ resultCount: 4 });

    await openPanel(user);

    expect(screen.getByRole('status')).toHaveTextContent('4 profils correspondent');
  });

  it('accorde l’annonce au singulier', () => {
    renderBar({ resultCount: 1 });

    expect(screen.getByRole('status')).toHaveTextContent('1 profil correspond');
  });

  it('annonce une absence de résultat sans afficher un zéro', () => {
    renderBar({ resultCount: 0 });

    expect(screen.getByRole('status')).toHaveTextContent('Aucun profil ne correspond');
    expect(screen.queryByText('0 profil correspond')).not.toBeInTheDocument();
  });
});
