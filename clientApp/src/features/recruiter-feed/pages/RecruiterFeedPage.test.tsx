import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFeedCandidates } from '../mocks';
import { RecruiterFeedPage } from './RecruiterFeedPage';

const deck = (...ids: number[]) => mockFeedCandidates.filter(({ id }) => ids.includes(id));

interface HarnessProps {
  candidates?: ReturnType<typeof deck>;
  openCandidateId?: number | null;
  onCloseProfile?: () => void;
}

/**
 * The three profile props are required, so every test drives them through the
 * same small state container the route holds in production.
 *
 * `onCloseProfile` replaces that container's close instead of spying beside it:
 * freezing the search param is how a test observes what the page does with a
 * URL the route would already have cleaned.
 */
function FeedHarness({ candidates, openCandidateId = null, onCloseProfile }: HarnessProps) {
  const [openId, setOpenId] = useState<number | null>(openCandidateId);

  return (
    <RecruiterFeedPage
      candidates={candidates}
      openCandidateId={openId}
      onOpenProfile={setOpenId}
      onCloseProfile={onCloseProfile ?? (() => setOpenId(null))}
    />
  );
}

const renderPage = (
  candidates?: ReturnType<typeof deck>,
  options: Omit<HarnessProps, 'candidates'> = {},
) => render(<FeedHarness candidates={candidates} {...options} />);

const heading = (name: string) => screen.getByRole('heading', { name });
const button = (name: string) => screen.getByRole('button', { name });
// The detail screen carries the profile as the page `h1`; the card carries the
// same text as an `h2`, so the level is what tells the two screens apart.
const detailHeading = (name: string) => screen.getByRole('heading', { level: 1, name });
const feedHeading = () => screen.queryByRole('heading', { level: 1, name: 'Candidats' });
const viewProfile = (fullName: string) => button(`Voir le profil de ${fullName}`);

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

describe('RecruiterFeedPage — écran de détail', () => {
  it('ouvre le profil depuis la carte et revient au feed', async () => {
    const user = userEvent.setup();
    renderPage(deck(1));

    await user.click(viewProfile('Camille Moreau'));

    expect(detailHeading('Camille Moreau · 29 ans')).toBeVisible();
    expect(button('Retour au feed')).toBeVisible();
    // The feed is replaced, not covered: two `h1` and a live filter bar behind
    // the profile would both be regressions.
    expect(feedHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'CDI' })).not.toBeInTheDocument();

    await user.click(button('Retour au feed'));

    expect(feedHeading()).toBeVisible();
    expect(viewProfile('Camille Moreau')).toBeVisible();
  });

  it('ouvre directement le profil ciblé par un lien profond', () => {
    renderPage(deck(1, 3), { openCandidateId: 3 });

    expect(detailHeading('Sofia Nguyen · 35 ans')).toBeVisible();
  });

  it('affiche un profil déjà décidé plutôt qu’un écran vide', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3), { openCandidateId: 1, onCloseProfile: () => {} });

    await user.click(button('Passer'));

    expect(detailHeading('Camille Moreau · 29 ans')).toBeVisible();
  });

  it('nettoie le paramètre quand le profil ciblé est introuvable', () => {
    const onCloseProfile = vi.fn();
    renderPage(deck(1, 3), { openCandidateId: 404, onCloseProfile });

    expect(heading('Camille Moreau · 29 ans')).toBeVisible();
    expect(onCloseProfile).toHaveBeenCalledTimes(1);
  });

  it('avance le deck et referme le profil quand la décision vient du détail', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(viewProfile('Camille Moreau'));
    await user.click(button('Passer'));

    expect(heading('Sofia Nguyen · 35 ans')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retour au feed' })).not.toBeInTheDocument();
  });

  it('compte un like pris depuis le détail', async () => {
    const user = userEvent.setup();
    renderPage(deck(1));

    await user.click(viewProfile('Camille Moreau'));
    await user.click(button('Liker'));

    expect(heading('Vous avez vu tous les profils')).toBeVisible();
    expect(screen.getByText('1 profil liké')).toBeVisible();
  });

  it('rend le focus à la zone du deck après une décision prise depuis le détail', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(viewProfile('Camille Moreau'));
    await user.click(button('Liker'));

    expect(screen.getByRole('region', { name: 'Profils à parcourir' })).toHaveFocus();
  });

  it('rend le focus à la zone du deck en revenant au feed', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(viewProfile('Camille Moreau'));
    await user.click(button('Retour au feed'));

    expect(screen.getByRole('region', { name: 'Profils à parcourir' })).toHaveFocus();
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

  it('désarme les flèches tant que le détail est ouvert', async () => {
    const user = userEvent.setup();
    renderPage(deck(1, 3));

    await user.click(viewProfile('Camille Moreau'));
    await user.keyboard('{ArrowRight}');

    expect(detailHeading('Camille Moreau · 29 ans')).toBeVisible();

    await user.click(button('Retour au feed'));

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
