import { Prisma, TagCategory } from '../../../generated/prisma/client';

/**
 * Normalises a batch of raw labels before they reach the shared tag
 * dictionary: trimmed, blanks dropped, duplicates collapsed.
 *
 * `tag` is global, so anything stored here is visible to every user. Without
 * the trim, `'React'` and `'React '` are two rows; without the blank filter, a
 * payload of `['   ']` creates an empty tag nobody can ever clean up.
 */
export function normaliseTagLabels(labels: string[]): string[] {
  return Array.from(
    new Set(
      labels.map((label) => label.trim()).filter((label) => label !== ''),
    ),
  );
}

/**
 * Resolves the tag ids for a batch of labels, creating the missing ones.
 *
 * Two queries whatever the batch size, instead of one upsert per label: the
 * per-label loop it replaces made the request cost grow linearly and blew past
 * the Prisma transaction timeout on large payloads.
 *
 * `skipDuplicates` relies on the unique index on `(tag.label, tag.category)`,
 * and the lookup is scoped to the same category: a label carries one row per
 * category it is used in, so « Anglais » can be a skill for one candidate and a
 * language for another without either of them overwriting the other.
 */
export async function resolveTagIds(
  tx: Prisma.TransactionClient,
  labels: string[],
  category: TagCategory,
): Promise<number[]> {
  const uniqueLabels = normaliseTagLabels(labels);
  if (uniqueLabels.length === 0) {
    return [];
  }

  await tx.tag.createMany({
    data: uniqueLabels.map((label) => ({ label, category })),
    skipDuplicates: true,
  });

  const tags = await tx.tag.findMany({
    where: { label: { in: uniqueLabels }, category },
    select: { id: true },
  });

  return tags.map((tag) => tag.id);
}
