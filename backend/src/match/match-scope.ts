import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';

const MATCH_SCOPE_SELECT = {
  id: true,
  candidateUserId: true,
  offerId: true,
  candidate: { select: { isActive: true } },
  offer: { select: { companyId: true, status: true } },
} as const;

export type MatchInScope = Prisma.MatchGetPayload<{
  select: typeof MATCH_SCOPE_SELECT;
}>;

/**
 * Reads a match the caller is entitled to act on, or answers 404.
 *
 * Same scope rule as `findMine` and `assertOwnedOffer`: the candidate of the
 * match, or any recruiter of the offer's company — not only whoever concluded
 * it — as long as that candidate is active. And one single answer for "no
 * such match" and "not yours", because a 403 on someone else's match confirms
 * the id exists, which is the whole of what an enumeration needs.
 */
export async function findMatchInScope(
  db: Prisma.TransactionClient,
  user: AuthUser,
  id: number,
): Promise<MatchInScope> {
  const match = await db.match.findUnique({
    where: { id },
    select: MATCH_SCOPE_SELECT,
  });
  if (!match) throw new NotFoundException('Match not found');

  if (user.userType === 'candidate') {
    if (match.candidateUserId !== user.id)
      throw new NotFoundException('Match not found');
    return match;
  }

  const profile = await db.recruiterProfile.findUnique({
    where: { userId: user.id },
    select: { companyId: true },
  });
  // `findMine` hides a deactivated candidate from recruiters, so the match is
  // out of their reach here too: neither its conversation nor its teardown,
  // which would destroy a history the candidate gets back on reactivation.
  if (
    !profile ||
    profile.companyId !== match.offer.companyId ||
    !match.candidate.isActive
  )
    throw new NotFoundException('Match not found');
  return match;
}
