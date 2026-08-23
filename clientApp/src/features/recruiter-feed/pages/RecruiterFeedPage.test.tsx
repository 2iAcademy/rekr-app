import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFeedCandidates } from '../mocks';
import { RecruiterFeedPage } from './RecruiterFeedPage';

const deck = (...ids: number[]) => mockFeedCandidates.filter(({ id }) => ids.includes(id));

const renderPage = (candidates?: ReturnType<typeof deck>) =>
  render(<RecruiterFeedPage candidates={candidates} />);

const heading = (name: string) => screen.getByRole('heading', { name });
const button = (name: string) => screen.getByRole('button', { name });

describe('RecruiterFeedPage', () => {
  it('ouvre le deck mocké sur le premier profil', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();
    expect(screen.getByText('8 profils correspondent')).toBeVisible();
    expect(heading('Camille Moreau · 29 ans')).toBeVisible();
  });

  it('avance au profil suivant quand le recruteur passe', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(button('Passer'));

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Camille Moreau · 29 ans' }),
    ).not.toBeInTheDocument();
  });

  it('décompte les profils likés au fil du deck', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(button('Liker'));

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
    await user.click(button('Passer'));

    expect(screen.getByText('1 profil liké')).toBeVisible();
  });

  it('restreint le deck au type de contrat sélectionné', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(button('Freelance'));

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
    expect(screen.getByText('2 profils correspondent')).toBeVisible();
  });

  it('invite à élargir la recherche quand les filtres écartent tout le monde', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(button('Stage'));
    await user.click(button('Expert'));

    expect(heading('Aucun profil ne passe vos filtres')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Liker' })).not.toBeInTheDocument();

    await user.click(button('Élargir la recherche'));

    expect(heading('Camille Moreau · 29 ans')).toBeVisible();
    expect(screen.getByText('8 profils correspondent')).toBeVisible();
  });

  it('annonce la fin du deck quand tous les profils ont été traités', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(button('Liker'));
    await user.click(button('Passer'));

    expect(heading('Vous avez vu tous les profils')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Élargir la recherche' })).not.toBeInTheDocument();
  });

  it('referme le détail quand le deck avance', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(button('Voir le profil'));
    expect(screen.getByRole('group', { name: 'Profil de Camille Moreau' })).toBeVisible();

    await user.click(button('Passer'));

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Profil de Sofia Nguyen' })).not.toBeInTheDocument();
    expect(button('Voir le profil')).toHaveAttribute('aria-expanded', 'false');
  });

  it('ouvre et referme le détail depuis la carte', async () => {
    const user = userEvent.setup();
    renderPage(deck(1));

    await user.click(button('Voir le profil'));

    const panel = screen.getByRole('group', { name: 'Profil de Camille Moreau' });

    expect(button('Voir le profil')).toHaveAttribute('aria-controls', panel.id);

    await user.click(button('Voir le profil'));

    expect(
      screen.queryByRole('group', { name: 'Profil de Camille Moreau' }),
    ).not.toBeInTheDocument();
  });

  it('passe et like au clavier', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3, 7));

    await user.keyboard('{ArrowRight}');
    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();

    await user.keyboard('{ArrowLeft}');
    expect(heading('Léa Bonnet · 31 ans')).toBeVisible();
  });

  it('ignore les flèches une fois le deck épuisé', async () => {
    const user = userEvent.setup();
    renderPage(deck(1));

    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowLeft}');

    expect(heading('Vous avez vu tous les profils')).toBeVisible();
    expect(screen.getByText('Aucun profil liké')).toBeVisible();
  });
});

describe('RecruiterFeedPage — état partagé entre deux candidats', () => {
  it('referme le détail quand un filtre change la tête du deck', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(button('Voir le profil'));
    expect(screen.getByRole('group', { name: 'Profil de Camille Moreau' })).toBeVisible();

    await user.click(button('Freelance'));

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Profil de Sofia Nguyen' })).not.toBeInTheDocument();
    expect(button('Voir le profil')).toHaveAttribute('aria-expanded', 'false');
  });

  it('referme le détail quand on élargit la recherche depuis l’état vide', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(button('Voir le profil'));
    await user.click(button('Stage'));
    await user.click(button('Expert'));
    await user.click(button('Élargir la recherche'));

    expect(button('Voir le profil')).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('group', { name: 'Profil de Camille Moreau' }),
    ).not.toBeInTheDocument();
  });
});

describe('RecruiterFeedPage — périmètre du raccourci clavier', () => {
  it('ne décide rien quand une puce de filtre a le focus', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(button('CDI'));
    expect(button('CDI')).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    expect(heading('Camille Moreau · 29 ans')).toBeVisible();
  });

  it('ignore une touche maintenue', () => {
    renderPage();

    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });

    expect(heading('Camille Moreau · 29 ans')).toBeVisible();
  });
});

describe('RecruiterFeedPage — restitution du deck', () => {
  const deckStatus = () => screen.getAllByRole('status').map((region) => region.textContent ?? '');

  it('annonce le profil affiché', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    expect(deckStatus()).toContain('Profil de Camille Moreau · 29 ans');

    await user.click(button('Liker'));

    expect(deckStatus()).toContain('Profil de Sofia Nguyen · 35 ans');
  });

  it('annonce la fin du deck', async () => {
    const user = userEvent.setup();
    renderPage(deck(1));

    await user.click(button('Passer'));

    expect(deckStatus()).toContain('Vous avez vu tous les profils');
  });

  it('rend le focus à la zone du deck après la dernière décision', async () => {
    const user = userEvent.setup();
    renderPage(deck(1));

    await user.click(button('Liker'));

    expect(screen.getByRole('region', { name: 'Profils à parcourir' })).toHaveFocus();
  });
});

const startDrag = (): HTMLElement => {
  const card = screen.getByRole('article').parentElement;

  if (!card) {
    throw new Error('la carte doit être enveloppée par la zone de glissement');
  }

  fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });

  return card;
};

const dragTo = (distance: number) =>
  fireEvent.pointerMove(window, { clientX: distance, clientY: 0, pointerId: 1 });

const release = () => fireEvent.pointerUp(window, { pointerId: 1 });

const dragCard = (distance: number) => {
  startDrag();
  dragTo(distance);
  release();
};

describe('RecruiterFeedPage — geste de glisser', () => {
  it('like le profil quand la carte part vers la droite', () => {
    renderPage(deck(1, 3));

    dragCard(200);

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
  });

  it('passe le profil quand la carte part vers la gauche', () => {
    renderPage(deck(1, 3));

    dragCard(-200);

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();

    dragCard(-200);

    expect(heading('Vous avez vu tous les profils')).toBeVisible();
    expect(screen.getByText('Aucun profil liké')).toBeVisible();
  });

  it('ne décide rien quand la carte revient à sa place', () => {
    renderPage(deck(1, 3));

    dragCard(40);

    expect(heading('Camille Moreau · 29 ans')).toBeVisible();
  });
});

// Advancing to the next profile is true of a like and of a pass alike: only the
// liked tally tells the two directions apart.
describe('RecruiterFeedPage — sens du glissement', () => {
  it('compte un like quand la carte part vers la droite', () => {
    renderPage(deck(1));

    dragCard(200);

    expect(screen.getByText('1 profil liké')).toBeVisible();
  });

  it('ne compte aucun like quand la carte part vers la gauche', () => {
    renderPage(deck(1));

    dragCard(-200);

    expect(screen.getByText('Aucun profil liké')).toBeVisible();
  });
});

describe('RecruiterFeedPage — la carte suit le doigt', () => {
  it('translate et incline la carte pendant le glissement', () => {
    renderPage(deck(1, 3));

    const card = startDrag();
    dragTo(60);

    expect(card).toHaveStyle({ transform: 'translateX(60px) rotate(2deg)' });
  });

  it('remet la carte en place quand le geste s’arrête sous le seuil', () => {
    renderPage(deck(1, 3));

    const card = startDrag();
    dragTo(40);
    release();

    expect(card.style.transform).toBe('');
  });
});
