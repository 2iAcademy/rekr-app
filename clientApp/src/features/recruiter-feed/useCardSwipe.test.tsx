import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCardSwipe } from './useCardSwipe';

interface HostProps {
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onInnerClick: () => void;
  threshold?: number;
  disabled?: boolean;
}

/**
 * A real host rather than `renderHook`: spreading `handlers` on a node is the
 * only way to check that the window listeners are wired and released, and the
 * inner button reproduces the card's `Voir le profil`.
 */
function SwipeHost({ onSwipeRight, onSwipeLeft, onInnerClick, threshold, disabled }: HostProps) {
  const { offset, isDragging, handlers } = useCardSwipe({
    onSwipeRight,
    onSwipeLeft,
    threshold,
    disabled,
  });

  return (
    <div data-testid="card" {...handlers}>
      <span data-testid="offset">{offset}</span>
      <span data-testid="dragging">{String(isDragging)}</span>
      <button type="button" onClick={onInnerClick}>
        Voir le profil
      </button>
    </div>
  );
}

const renderHost = (options: Partial<Omit<HostProps, 'onSwipeRight' | 'onSwipeLeft'>> = {}) => {
  const onSwipeRight = vi.fn();
  const onSwipeLeft = vi.fn();
  const onInnerClick = options.onInnerClick ?? vi.fn();

  const view = render(
    <SwipeHost
      onSwipeRight={onSwipeRight}
      onSwipeLeft={onSwipeLeft}
      onInnerClick={onInnerClick}
      threshold={options.threshold}
      disabled={options.disabled}
    />,
  );

  return { ...view, onSwipeRight, onSwipeLeft, onInnerClick };
};

const START_X = 100;
const START_Y = 100;
const POINTER = 1;

const card = (): HTMLElement => screen.getByTestId('card');
const profileButton = (): HTMLElement => screen.getByRole('button', { name: 'Voir le profil' });
const offset = (): number => Number(screen.getByTestId('offset').textContent);
const dragging = (): string | null => screen.getByTestId('dragging').textContent;

const pointerDown = (
  target: Element,
  { x = START_X, y = START_Y, button = 0, pointerId = POINTER } = {},
): boolean => fireEvent.pointerDown(target, { clientX: x, clientY: y, button, pointerId });

const pointerMove = (x: number, y: number = START_Y, pointerId: number = POINTER): boolean =>
  fireEvent.pointerMove(window, { clientX: x, clientY: y, pointerId });

// Deliberately coordinate-less: the decision must come from the offset the hook
// tracked, not from wherever the release event happens to say the pointer is.
const pointerUp = (pointerId: number = POINTER): boolean =>
  fireEvent.pointerUp(window, { pointerId });

const pointerCancel = (pointerId: number = POINTER): boolean =>
  fireEvent.pointerCancel(window, { pointerId });

describe('useCardSwipe', () => {
  it('part au repos, sans décalage ni glissement en cours', () => {
    renderHost();

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');
  });

  it('suit le doigt pendant le glissement puis revient au repos', () => {
    renderHost();

    pointerDown(card());
    pointerMove(START_X + 60);

    expect(offset()).toBe(60);
    expect(dragging()).toBe('true');

    pointerMove(START_X + 90);
    expect(offset()).toBe(90);

    pointerUp();

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');
  });

  it('like le profil quand la carte est tirée vers la droite au-delà du seuil', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 121);
    pointerUp();

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(offset()).toBe(0);
  });

  it('passe le profil quand la carte est tirée vers la gauche au-delà du seuil', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X - 121);
    pointerUp();

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(offset()).toBe(0);
  });

  it('ne décide rien quand le geste s’arrête en dessous du seuil', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 60);
    pointerUp();

    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');
  });

  it('exige de dépasser le seuil, l’atteindre ne suffit pas', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost({ threshold: 120 });

    pointerDown(card());
    pointerMove(START_X + 120);
    pointerUp();

    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('respecte un seuil personnalisé', () => {
    const { onSwipeRight } = renderHost({ threshold: 40 });

    pointerDown(card());
    pointerMove(START_X + 41);
    pointerUp();

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('rend la main au défilement vertical de la page', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 4, START_Y + 40);

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');

    pointerMove(START_X + 300, START_Y + 40);
    pointerUp();

    expect(offset()).toBe(0);
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('laisse un mouvement de quelques pixels rester un clic', async () => {
    const user = userEvent.setup();
    const { onSwipeRight, onSwipeLeft, onInnerClick } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 6);

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');

    pointerUp();
    await user.click(profileButton());

    expect(onInnerClick).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ne démarre pas le geste quand il part d’un contrôle de la carte', async () => {
    const user = userEvent.setup();
    const { onSwipeRight, onSwipeLeft, onInnerClick } = renderHost();

    pointerDown(profileButton());
    pointerMove(START_X + 400);
    pointerUp();

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();

    await user.click(profileButton());
    expect(onInnerClick).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien quand le geste est désactivé', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost({ disabled: true });

    pointerDown(card());
    pointerMove(START_X + 400);
    pointerUp();

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('annule sans jamais décider sur pointercancel', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 300);
    pointerCancel();

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ne décide qu’une fois quand le relâchement est suivi d’une annulation', () => {
    const { onSwipeRight } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 300);
    pointerUp();
    pointerCancel();

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('ne décide qu’une fois quand le relâchement est répété', () => {
    const { onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X - 300);
    pointerUp();
    pointerUp();

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('ignore les boutons de souris secondaires', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card(), { button: 2 });
    pointerMove(START_X + 400);
    pointerUp();

    expect(offset()).toBe(0);
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ne suit que le doigt qui a démarré le geste', () => {
    const { onSwipeRight } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 400, START_Y, 2);

    expect(offset()).toBe(0);

    pointerMove(START_X + 300);
    expect(offset()).toBe(300);

    pointerUp(2);
    expect(onSwipeRight).not.toHaveBeenCalled();

    pointerUp();
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('refuse un second doigt pendant un geste en cours', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 300);
    pointerDown(card(), { x: 500, pointerId: 2 });
    pointerMove(500 - 300, START_Y, 2);

    expect(offset()).toBe(300);

    pointerUp();

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('enchaîne deux gestes de suite', () => {
    const { onSwipeRight, onSwipeLeft } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 300);
    pointerUp();

    pointerDown(card());
    pointerMove(START_X - 300);
    pointerUp();

    expect(offset()).toBe(0);
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('retire ses écouteurs dès la fin du geste', () => {
    const { onSwipeRight } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 60);
    pointerUp();

    pointerMove(START_X + 400);

    expect(offset()).toBe(0);
    expect(dragging()).toBe('false');

    pointerUp();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('oublie un geste en cours quand la carte est démontée', () => {
    const { onSwipeRight, unmount } = renderHost();

    pointerDown(card());
    pointerMove(START_X + 300);
    unmount();

    pointerMove(START_X + 400);
    pointerUp();

    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('rend à window chacun des écouteurs qu’il lui a posés', () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHost();

    pointerDown(card());

    const gestureListeners = added.mock.calls.filter(([type]) =>
      ['pointermove', 'pointerup', 'pointercancel'].includes(type),
    );
    expect(gestureListeners.map(([type]) => type)).toEqual([
      'pointermove',
      'pointerup',
      'pointercancel',
    ]);

    unmount();

    for (const [type, listener] of gestureListeners) {
      expect(removed).toHaveBeenCalledWith(type, listener);
    }
  });
});
