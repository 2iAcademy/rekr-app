import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { MatchListQueryDto } from './dto/match-list-query.dto';

export interface MatchListItem {
  id: number;
  matchedAt: Date;
  offer: {
    id: number;
    title: string;
  };
  counterpart: {
    kind: 'company';
    id: number;
    name: string;
    avatarUrl: string | null;
    headline: string | null;
  };
}

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The matches of the calling candidate.
   *
   * A candidate route only: a match is born of a reciprocal like on one given
   * offer, so a recruiter reads it on the offer concerned rather than in a list
   * spanning every post of their company. The role is enforced on the
   * controller, and this method has no recruiter branch left to fall back on.
   *
   * Offers that left `open` are dropped: a match on a filled or closed post is
   * a dead end, and showing it would invite a candidate to wait for an answer
   * that is no longer coming.
   */
  async findMine(
    user: AuthUser,
    { page = 1, limit = 50 }: MatchListQueryDto = new MatchListQueryDto(),
  ): Promise<MatchListItem[]> {
    const matches = await this.prisma.match.findMany({
      where: { candidateUserId: user.id, offer: { status: 'open' } },
      orderBy: { matchedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        matchedAt: true,
        offer: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    return matches.map((match) => ({
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
    }));
  }
}
