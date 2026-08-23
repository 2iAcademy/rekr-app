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
    kind: 'company' | 'candidate';
    id: number;
    name: string;
    avatarUrl: string | null;
    headline: string | null;
  } | null;
}

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(
    user: AuthUser,
    { page = 1, limit = 50 }: MatchListQueryDto = new MatchListQueryDto(),
  ): Promise<MatchListItem[]> {
    const pagination = {
      skip: (page - 1) * limit,
      take: limit,
    };

    if (user.userType === 'candidate') {
      const matches = await this.prisma.match.findMany({
        where: { candidateUserId: user.id, offer: { status: 'open' } },
        orderBy: { matchedAt: 'desc' },
        ...pagination,
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

    // `recruiterUserId` is nullable in the schema, while every match points
    // to an offer. Scoping through that offer's company therefore covers both
    // current matches and historical rows created before the recruiter link.
    const matches = await this.prisma.match.findMany({
      where: {
        offer: {
          company: {
            recruiter: { some: { userId: user.id } },
          },
        },
      },
      orderBy: { matchedAt: 'desc' },
      ...pagination,
      select: {
        id: true,
        matchedAt: true,
        offer: {
          select: {
            id: true,
            title: true,
          },
        },
        candidate: {
          select: {
            id: true,
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
      },
    });

    return matches.map((match) => {
      const profile = match.candidate.candidateProfile;

      return {
        id: match.id,
        matchedAt: match.matchedAt,
        offer: { id: match.offer.id, title: match.offer.title },
        counterpart: profile
          ? {
              kind: 'candidate' as const,
              id: match.candidate.id,
              name: `${profile.firstName} ${profile.lastName}`,
              avatarUrl: profile.picture,
              headline: profile.desiredJobTitle,
            }
          : null,
      };
    });
  }
}
