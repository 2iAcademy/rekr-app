/**
 * What the offers list hands to the applicants screen through the router state.
 *
 * The applicants endpoint answers people, not the offer they applied to, so the
 * title shown above the list travels with the navigation instead of costing a
 * second request. A direct visit (typed URL, reload in another tab) carries
 * nothing, and the screen simply goes without the reminder.
 */
export interface ApplicantsLocationState {
  offerTitle: string;
}

/** Reads the offer title from an untyped `location.state`, or `null`. */
export function offerTitleFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('offerTitle' in state)) {
    return null;
  }

  const { offerTitle } = state;

  return typeof offerTitle === 'string' && offerTitle.trim() !== '' ? offerTitle.trim() : null;
}
