export type Decision = 'passed' | 'liked';

export type DeckDecisions = Readonly<Record<number, Decision>>;

interface DeckItem {
  id: number;
}

export const noDecisions: DeckDecisions = Object.freeze({});

export const recordDecision = (
  decisions: DeckDecisions,
  id: number,
  decision: Decision,
): DeckDecisions => ({ ...decisions, [id]: decision });

const isUndecided = (item: DeckItem, decisions: DeckDecisions): boolean =>
  decisions[item.id] === undefined;

export const remainingItems = <Item extends DeckItem>(
  items: readonly Item[],
  decisions: DeckDecisions,
  matches: (item: Item) => boolean,
): Item[] => items.filter((item) => isUndecided(item, decisions) && matches(item));

export const likedCount = (decisions: DeckDecisions): number =>
  Object.values(decisions).filter((decision) => decision === 'liked').length;

const undecidedCount = <Item extends DeckItem>(
  items: readonly Item[],
  decisions: DeckDecisions,
): number => items.filter((item) => isUndecided(item, decisions)).length;

export type EmptyReason = 'no-match' | 'exhausted';

export const emptyReason = <Item extends DeckItem>(
  items: readonly Item[],
  decisions: DeckDecisions,
): EmptyReason => (undecidedCount(items, decisions) === 0 ? 'exhausted' : 'no-match');
