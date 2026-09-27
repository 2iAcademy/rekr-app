import { MAX_JOB_FAMILIES } from '@/lib/bounds';

/**
 * The trades a candidate picked, as one ordered list: the first is the primary
 * one, the others follow in the order the chips show them.
 *
 * The API reads the order as the preference — the feed ranks the primary trade
 * above the others without filtering any of them out — so the order here is a
 * choice the candidate makes, not a side effect of which pill was clicked
 * first. `toggleJobFamily` never reorders the primary; only
 * `choosePrimaryJobFamily` does.
 */

const inReferenceOrder = (ids: string[], reference: readonly string[]): string[] =>
  reference.filter((known) => ids.includes(known));

const withPrimary = (
  primary: string | undefined,
  others: string[],
  reference: readonly string[],
): string[] =>
  primary === undefined
    ? []
    : [
        primary,
        ...inReferenceOrder(
          others.filter((id) => id !== primary),
          reference,
        ),
      ];

export const toggleJobFamily = (
  values: string[],
  id: string,
  reference: readonly string[],
): string[] => {
  if (values.includes(id)) {
    const kept = values.filter((value) => value !== id);

    // Removing the primary promotes the next trade rather than leaving the
    // list without one: the candidate can still pick another right after.
    return withPrimary(kept[0], kept, reference);
  }

  // Refused on the way in rather than by disabling the untaken pills: a
  // disabled pill reads as « unavailable » when it means « deselect one first ».
  if (values.length >= MAX_JOB_FAMILIES) {
    return values;
  }

  return withPrimary(values[0] ?? id, [...values, id], reference);
};

export const choosePrimaryJobFamily = (
  values: string[],
  id: string,
  reference: readonly string[],
): string[] => (values.includes(id) ? withPrimary(id, values, reference) : values);
