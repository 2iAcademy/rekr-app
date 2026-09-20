import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LikeListQueryDto } from './dto/like-list-query.dto';

export interface LikeListItem {
  offerId: number;
  candidateUserId: number | null;
  likedAt: Date;
  offer: { id: number; title: string };
  counterpart: {
    kind: 'company' | 'candidate';
    id: number;
    name: string;
    avatarUrl: string | null;
    headline: string | null;
  };
}

const SENT_SELECT = {
  offerId: true,
  likedAt: true,
  offer: {
    select: {
      id: true,
      title: true,
      company: { select: { id: true, name: true, logo: true } },
    },
  },
} as const;

type SentRow = Prisma.CandidateLikesOfferGetPayload<{
  select: typeof SENT_SELECT;
}>;

interface ReceivedRow {
  candidateUserId: number;
  offerId: number;
  likedAt: Date;
  offerTitle: string;
  firstName: string;
  lastName: string;
  picture: string | null;
  desiredJobTitle: string | null;
}

@Injectable()
export class LikeService {
  constructor(private readonly prisma: PrismaService) {}

  async findSent(
    user: AuthUser,
    { page = 1, limit = 50 }: LikeListQueryDto = new LikeListQueryDto(),
  ): Promise<LikeListItem[]> {
    const likes = await this.prisma.candidateLikesOffer.findMany({
      // Both exclusions belong in the `where`, not after the read: filtering a
      // page once it is fetched returns fewer rows than asked without it being
      // the last one, and the caller cannot tell the two apart.
      where: {
        candidateUserId: user.id,
        offer: {
          status: 'open',
          matches: { none: { candidateUserId: user.id } },
        },
      },
      orderBy: [{ likedAt: 'desc' }, { offerId: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: SENT_SELECT,
    });

    return likes.map((like: SentRow) => ({
      offerId: like.offerId,
      candidateUserId: null,
      likedAt: like.likedAt,
      offer: { id: like.offer.id, title: like.offer.title },
      counterpart: {
        kind: 'company',
        id: like.offer.company.id,
        name: like.offer.company.name,
        avatarUrl: like.offer.company.logo,
        headline: like.offer.title,
      },
    }));
  }

  /**
   * Written in SQL, unlike every other read of this codebase.
   *
   * Two of the four exclusions correlate the like row with another table on
   * *both* of its key columns — `match(candidate, offer)` and
   * `recruiter_passes_candidate(candidate, offer)`. A Prisma relation filter
   * cannot reference the row it is filtering, so the only way to express them
   * there would be to fetch the excluded pairs first and inline them, which
   * grows with the company's history. Applying them after the read is not an
   * option either: it would shorten a page that is not the last one.
   */
  async findReceived(
    user: AuthUser,
    { page = 1, limit = 50 }: LikeListQueryDto = new LikeListQueryDto(),
  ): Promise<LikeListItem[]> {
    // Same scope rule as `assertOwnedOffer`: the company, not the creator.
    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId: user.id },
      select: { companyId: true },
    });
    if (!profile) {
      throw new NotFoundException('Recruiter has no company');
    }

    const rows = await this.prisma.$queryRaw<ReceivedRow[]>(Prisma.sql`
      SELECT cl.fk_user_candidate    AS "candidateUserId",
             cl.fk_offer             AS "offerId",
             cl.liked_at             AS "likedAt",
             o.title                 AS "offerTitle",
             cp.first_name           AS "firstName",
             cp.last_name            AS "lastName",
             cp.picture              AS "picture",
             cp.desired_job_title    AS "desiredJobTitle"
      FROM candidate_likes_offer cl
      JOIN offer o ON o.id = cl.fk_offer
      JOIN "user" u ON u.id = cl.fk_user_candidate
      -- An inner join, because a like can exist without a profile: signup
      -- writes the user, the wizard writes the profile. Such a row has
      -- nothing to show.
      JOIN candidate_profile cp ON cp.fk_user = u.id
      WHERE o.fk_company = ${profile.companyId}
        AND u.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM match m
          WHERE m.fk_user_candidate = cl.fk_user_candidate
            AND m.fk_offer = cl.fk_offer
        )
        AND NOT EXISTS (
          SELECT 1 FROM recruiter_passes_candidate rp
          WHERE rp.fk_user_recruiter = ${user.id}
            AND rp.fk_user_candidate = cl.fk_user_candidate
            AND rp.fk_offer = cl.fk_offer
        )
      ORDER BY cl.liked_at DESC, cl.fk_user_candidate DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `);

    return rows.map((row) => ({
      offerId: row.offerId,
      candidateUserId: row.candidateUserId,
      likedAt: row.likedAt,
      offer: { id: row.offerId, title: row.offerTitle },
      counterpart: {
        kind: 'candidate',
        id: row.candidateUserId,
        name: `${row.firstName} ${row.lastName}`,
        avatarUrl: row.picture,
        headline: row.desiredJobTitle,
      },
    }));
  }
}
