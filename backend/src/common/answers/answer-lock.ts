import { Prisma } from '../../../generated/prisma/client';

/**
 * Serialises everything that decides what a candidate and a recruiter
 * answered about one offer.
 *
 * The answers live in five tables — the two likes, the two passes, the match —
 * and each holds only its own primary key, so no constraint can say that they
 * exclude one another or that a match rests on a like. Under READ COMMITTED
 * the checks that stand in for those constraints all read a state the
 * concurrent transaction has not committed yet, and both sides then write: a
 * like and a pass standing together, and a match left on a like that was being
 * withdrawn — which is worse than it looks, because the candidate is then
 * engaged on an application they no longer have and `unlike` answers 409 from
 * that point on.
 *
 * A transaction-scoped advisory lock is preferred over `Serializable`, which
 * would need a P2034 replay loop around five handlers and would still let a
 * retried write land after the client gave up, and over folding the answers
 * into one table, which is a migration and a model rewrite to buy an invariant
 * this one line already holds. Cost: one round trip per write, and contention
 * bounded by the pair — only one candidate double-tapping one offer ever
 * waits, never two candidates, never two offers.
 *
 * Taken before any read that decides an answer, since a lock acquired after
 * the check it is meant to protect guards nothing. Run through `$executeRaw`
 * rather than `$queryRaw`, which cannot decode the `void` the function
 * returns.
 *
 * A free function rather than a method: the handlers that need it hang off two
 * different services, `OfferService` already depends on `MatchService`, and
 * making the dependency go back the other way for two lines would close a
 * circular module reference. Putting it on `MatchService` instead would give
 * the match module ownership of a lock that also governs answers no match
 * exists for. It stays keyed on the pair, which is the whole of its contract —
 * the same precedent `resolveTagIds` sets for a `tx`-taking helper.
 */
export function lockAnswer(
  tx: Prisma.TransactionClient,
  candidateUserId: number,
  offerId: number,
): Promise<number> {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(${candidateUserId}::int, ${offerId}::int)`;
}
