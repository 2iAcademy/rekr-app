import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
import { lockAnswer } from '../common/answers/answer-lock';
import { PrismaService } from '../prisma/prisma.service';
import { MatchListQueryDto } from './dto/match-list-query.dto';

export interface MatchListItem {
  id: number;
  matchedAt: Date;
  offer: { id: number; title: string };
  counterpart: {
    kind: 'company' | 'candidate';
    id: number;
    name: string;
    avatarUrl: string | null;
    headline: string | null;
  };
}

export interface ReciprocalMatchResult {
  matchCreated: boolean;
  match: MatchListItem;
}

const MATCH_LIST_SELECT = {
  id: true,
  candidateUserId: true,
  matchedAt: true,
  offer: {
    select: {
      id: true,
      title: true,
      company: { select: { id: true, name: true, logo: true } },
    },
  },
  candidate: {
    select: {
      candidateProfile: {
        select: {
          firstName: true,
          lastName: true,
          picture: true,
          desiredJobTitle: true,
        },
      },
    },
  },
} as const;

type MatchRow = Prisma.MatchGetPayload<{ select: typeof MATCH_LIST_SELECT }>;
type Viewer = 'candidate' | 'recruiter';

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  async tryCreateReciprocalMatch(
    tx: Prisma.TransactionClient,
    candidateUserId: number,
    offerId: number,
    recruiterUserId: number,
    viewer: Viewer,
  ): Promise<ReciprocalMatchResult> {
    const created = await tx.match.createMany({
      data: [{ candidateUserId, offerId, recruiterUserId }],
      skipDuplicates: true,
    });
    const match = await tx.match.findUnique({
      where: { candidateUserId_offerId: { candidateUserId, offerId } },
      select: MATCH_LIST_SELECT,
    });
    if (!match) throw new Error('Match was not found after creation attempt');
    return {
      matchCreated: created.count === 1,
      match: this.toListItem(match, viewer),
    };
  }

  async findMine(
    user: AuthUser,
    { page = 1, limit = 50 }: MatchListQueryDto = new MatchListQueryDto(),
  ): Promise<MatchListItem[]> {
    const viewer: Viewer =
      user.userType === 'recruiter' ? 'recruiter' : 'candidate';

    // Same scope rule as `assertOwnedOffer`: the company, not whoever
    // concluded the match. Every listed row then points at an offer screen its
    // reader can actually open, and a match a colleague concluded stops
    // vanishing between the two tabs.
    let where: Prisma.MatchWhereInput;
    if (viewer === 'candidate') {
      where = { candidateUserId: user.id, offer: { status: 'open' } };
    } else {
      const profile = await this.prisma.recruiterProfile.findUnique({
        where: { userId: user.id },
        select: { companyId: true },
      });
      // Deliberately unlike `/likes/received`, which answers 404 here: this
      // endpoint has always answered 200 for a recruiter without a company,
      // and the screen is out of reach for them anyway.
      if (!profile) return [];
      // Same population as `findApplicants` and `/likes/received`, and in the
      // `where` rather than after the read: filtering a fetched page returns
      // fewer rows than asked without it being the last one. A deactivated
      // account must not have its name served, and a signup that never
      // reached the profile wizard has nothing to show — the row would open a
      // candidate screen they are absent from.
      where = {
        offer: { status: 'open', companyId: profile.companyId },
        candidate: { isActive: true, candidateProfile: { isNot: null } },
      };
    }

    const matches = await this.prisma.match.findMany({
      where,
      // `id` breaks the ties `matchedAt` leaves — they are reachable, Prisma
      // stamps it client-side to the millisecond. Past a few hundred rows
      // Postgres sorts a paginated read with an unstable top-N heapsort, so
      // two OFFSETs disagree on the order of the ties and a row is served
      // twice while another is never served at all.
      orderBy: [{ matchedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: MATCH_LIST_SELECT,
    });
    return matches.map((match) => this.toListItem(match, viewer));
  }

  /**
   * Puts an end to a match, and to everything that would re-create it.
   *
   * Either party may pull the plug, and the answer trail that produced the
   * match goes with the row. Deleting the match alone is not an option:
   * `/likes/sent` and `/likes/received` hide a pair by the existence of the
   * match, not by the like, so both screens would show the withdrawn
   * application again the instant the match disappeared — and the offer would
   * walk straight back into the feed it was matched out of, which is what the
   * candidate pass prevents.
   *
   * No recruiter pass is written, deliberately. `recruiter_passes_candidate`
   * is read twice over: `/likes/received` filters on it per recruiter, and
   * `findApplicants` serves it as `recruiterPassedAt`, which the applicants
   * screen reads as a decision that recruiter made. Writing it here would
   * credit one recruiter with a refusal they never pronounced — the candidate
   * may well be the one who ended the match — and nothing purges it
   * afterwards, since `likeApplicant` has no counterpart to the
   * `candidatePassesOffer` delete `like` performs. A later application would
   * then stay invisible to them while their colleagues see it. Dropping the
   * likes is what keeps this pair apart; a new like is a new decision, and it
   * deserves to be seen.
   *
   * Nothing here is reversible on purpose: re-liking is how the pair starts
   * over, and that path already exists.
   */
  async unmatch(user: AuthUser, id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // The advisory lock is keyed on (candidate, offer) while this endpoint is
      // addressed by the match id, so the pair is not known until the row has
      // been read. Hence read, decide, lock, read again — and the decision
      // comes before the lock on purpose: holding the pair of a match that is
      // none of the caller's business would let a stranger serialise the writes
      // of the two people it belongs to.
      const scope = await tx.match.findUnique({
        where: { id },
        select: {
          candidateUserId: true,
          offerId: true,
          offer: { select: { companyId: true } },
        },
      });
      if (!scope) throw new NotFoundException('Match not found');
      const { candidateUserId, offerId } = scope;

      // Same scope rule as `findMine` and `assertOwnedOffer`: the company, not
      // whoever concluded the match — a recruiter acts on what their matches
      // tab shows them, colleague's match or not. And one single answer for
      // "no such match" and "not yours", because a 403 on someone else's match
      // confirms the id exists, which is the whole of what an enumeration
      // needs.
      if (user.userType === 'candidate') {
        if (candidateUserId !== user.id)
          throw new NotFoundException('Match not found');
      } else {
        const profile = await tx.recruiterProfile.findUnique({
          where: { userId: user.id },
          select: { companyId: true },
        });
        if (!profile || profile.companyId !== scope.offer.companyId)
          throw new NotFoundException('Match not found');
      }

      await lockAnswer(tx, candidateUserId, offerId);

      // The row the decision rests on was read with nothing holding it. Read it
      // again under the lock, and a match that vanished in between — a
      // concurrent unmatch, a cascading account or offer deletion — answers 404
      // instead of having a teardown written for it. Its existence is all this
      // read is for: no value from it feeds a write, so nothing else here needs
      // the lock's protection.
      const held = await tx.match.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!held) throw new NotFoundException('Match not found');

      await tx.match.delete({ where: { id } });
      await tx.candidateLikesOffer.deleteMany({
        where: { candidateUserId, offerId },
      });
      // Scoped on the pair and not on one recruiter: `recruiter_likes_candidate`
      // is keyed on the recruiter too, so a colleague's surviving like would
      // re-create the match the next time the candidate likes the offer.
      await tx.recruiterLikesCandidate.deleteMany({
        where: { candidateUserId, offerId },
      });
      await tx.candidatePassesOffer.createMany({
        data: [{ candidateUserId, offerId }],
        skipDuplicates: true,
      });
    });
  }

  private toListItem(match: MatchRow, viewer: Viewer): MatchListItem {
    if (viewer === 'candidate')
      return {
        id: match.id,
        matchedAt: match.matchedAt,
        offer: { id: match.offer.id, title: match.offer.title },
        counterpart: {
          kind: 'company',
          id: match.offer.company.id,
          name: match.offer.company.name,
          avatarUrl: match.offer.company.logo,
          headline: match.offer.title,
        },
      };
    const profile = match.candidate.candidateProfile;
    return {
      id: match.id,
      matchedAt: match.matchedAt,
      offer: { id: match.offer.id, title: match.offer.title },
      counterpart: {
        kind: 'candidate',
        id: match.candidateUserId,
        name: profile ? `${profile.firstName} ${profile.lastName}` : 'Candidat',
        avatarUrl: profile?.picture ?? null,
        headline: profile?.desiredJobTitle ?? null,
      },
    };
  }
}
