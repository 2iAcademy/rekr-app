import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
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
    const matches = await this.prisma.match.findMany({
      where:
        viewer === 'candidate'
          ? { candidateUserId: user.id, offer: { status: 'open' } }
          : { recruiterUserId: user.id, offer: { status: 'open' } },
      orderBy: { matchedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: MATCH_LIST_SELECT,
    });
    return matches.map((match) => this.toListItem(match, viewer));
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
