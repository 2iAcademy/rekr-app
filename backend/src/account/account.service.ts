import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyPassword } from '../auth/password-hash';
import { PrismaService } from '../prisma/prisma.service';
import { FileSlotService } from '../storage/file-slot.service';

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  userType: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  passwordChangedAt: true,
  termsAcceptedAt: true,
  termsVersion: true,
  lastActiveAt: true,
} as const;

/**
 * Whatever the offer's status now, unlike the feed and the like lists, which
 * only name open offers. The right of access covers every interaction the
 * user had, and each one was made on an offer that was open at the time — the
 * title shown is the current one, not a secret the export would reveal.
 */
const OFFER_WITH_COMPANY = {
  select: { title: true, company: { select: { name: true } } },
} as const;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileSlotService,
  ) {}

  /**
   * Hard deletion, not anonymisation: nothing in the application needs a
   * departed user's rows, so there is nothing to keep them for. The schema's
   * cascades carry the rest — profile, tags, trades, likes, passes, matches,
   * sessions. What they cannot decide is the company, and what they cannot
   * reach at all are the files.
   *
   * The files go last, once the transaction is committed: deleting them first
   * and then failing the transaction would leave an account pointing at a
   * picture that no longer exists — the same ordering `FileSlotService.replace`
   * follows, for the same reason.
   */
  async delete(userId: number, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new ForbiddenException('Incorrect password.');
    }

    await this.erase(userId);
  }

  /**
   * The erasure itself, with no credential check: shared by the user's own
   * request and by the retention purge, so that both remove exactly the same
   * things.
   */
  async erase(userId: number): Promise<void> {
    const erasedCompanyId = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.recruiterProfile.findUnique({
        where: { userId },
        select: { companyId: true },
      });
      const companyId = profile?.companyId;
      if (companyId !== undefined) {
        // Two colleagues leaving at once would each count the other and both
        // keep the company. Locking its row serialises them, and the second
        // one counts zero.
        await tx.$queryRaw`SELECT id FROM company WHERE id = ${companyId} FOR UPDATE`;
      }

      await tx.user.delete({ where: { id: userId } });

      if (companyId === undefined) {
        return null;
      }

      const colleagues = await tx.recruiterProfile.count({
        where: { companyId },
      });
      if (colleagues > 0) {
        return null;
      }

      // Nobody left to manage it: its offers would stay in the feed and
      // collect likes nobody answers. It goes, with its offers and with the
      // likes and matches hanging on them.
      await tx.company.delete({ where: { id: companyId } });
      return companyId;
    });

    // By owner directory, not by the keys the rows held: a file no row points
    // at any more is just as much this user's, and just as publicly served.
    await this.files.discardOwner('candidates', userId);
    if (erasedCompanyId !== null) {
      await this.files.discardOwner('companies', erasedCompanyId);
    }
  }

  /**
   * Everything the application holds about the caller, and only that. What
   * other people wrote about them is included when it is about them — a
   * recruiter's like on their profile — but reduced to the company that
   * expressed it: the recruiter's own name is the recruiter's data.
   *
   * File slots are exported as their storage keys; the bytes are served by
   * the routes that already guard them.
   */
  async export(userId: number) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });
    if (!account) {
      throw new UnauthorizedException('This account no longer exists.');
    }

    return {
      exportedAt: new Date().toISOString(),
      account,
      ...(account.userType === 'recruiter'
        ? await this.recruiterData(userId)
        : await this.candidateData(userId)),
    };
  }

  private async candidateData(userId: number) {
    const [profile, tags, jobFamilies, likes, passes, liked, passed, matches] =
      await Promise.all([
        this.prisma.candidateProfile.findUnique({
          where: { userId },
          omit: { id: true, userId: true },
        }),
        this.prisma.candidateTag.findMany({
          where: { candidateUserId: userId },
          select: { tag: { select: { label: true, category: true } } },
        }),
        this.prisma.candidateJobFamily.findMany({
          where: { candidateUserId: userId },
          select: { jobFamily: { select: { label: true } } },
        }),
        this.prisma.candidateLikesOffer.findMany({
          where: { candidateUserId: userId },
          select: { offerId: true, likedAt: true, offer: OFFER_WITH_COMPANY },
          orderBy: { likedAt: 'desc' },
        }),
        this.prisma.candidatePassesOffer.findMany({
          where: { candidateUserId: userId },
          select: { offerId: true, passedAt: true, offer: OFFER_WITH_COMPANY },
          orderBy: { passedAt: 'desc' },
        }),
        this.prisma.recruiterLikesCandidate.findMany({
          where: { candidateUserId: userId },
          select: { offerId: true, likedAt: true, offer: OFFER_WITH_COMPANY },
          orderBy: { likedAt: 'desc' },
        }),
        this.prisma.recruiterPassesCandidate.findMany({
          where: { candidateUserId: userId },
          select: { offerId: true, passedAt: true, offer: OFFER_WITH_COMPANY },
          orderBy: { passedAt: 'desc' },
        }),
        this.prisma.match.findMany({
          where: { candidateUserId: userId },
          select: { offerId: true, matchedAt: true, offer: OFFER_WITH_COMPANY },
          orderBy: { matchedAt: 'desc' },
        }),
      ]);

    const onOffer = <T extends { offerId: number; offer: OfferRef }>({
      offer,
      ...row
    }: T) => ({
      ...row,
      offerTitle: offer.title,
      companyName: offer.company.name,
    });

    return {
      candidateProfile: profile,
      tags: tags.map(({ tag }) => tag),
      jobFamilies: jobFamilies.map(({ jobFamily }) => jobFamily),
      likesSent: likes.map(onOffer),
      passesSent: passes.map(onOffer),
      likesReceived: liked.map(onOffer),
      passesReceived: passed.map(onOffer),
      matches: matches.map(onOffer),
    };
  }

  private async recruiterData(userId: number) {
    const [profile, offers, likes, passes, matches] = await Promise.all([
      this.prisma.recruiterProfile.findUnique({
        where: { userId },
        select: {
          firstName: true,
          lastName: true,
          jobTitle: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          company: { omit: { latitude: true, longitude: true } },
        },
      }),
      this.prisma.offer.findMany({
        where: { createdById: userId },
        select: { id: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recruiterLikesCandidate.findMany({
        where: { recruiterUserId: userId },
        select: { offerId: true, candidateUserId: true, likedAt: true },
        orderBy: { likedAt: 'desc' },
      }),
      this.prisma.recruiterPassesCandidate.findMany({
        where: { recruiterUserId: userId },
        select: { offerId: true, candidateUserId: true, passedAt: true },
        orderBy: { passedAt: 'desc' },
      }),
      this.prisma.match.findMany({
        where: { recruiterUserId: userId },
        select: { offerId: true, candidateUserId: true, matchedAt: true },
        orderBy: { matchedAt: 'desc' },
      }),
    ]);

    const { company = null, ...recruiterProfile } = profile ?? {};

    return {
      recruiterProfile: profile ? recruiterProfile : null,
      company,
      offersCreated: offers,
      likesSent: likes,
      passesSent: passes,
      matches,
    };
  }
}

type OfferRef = { title: string; company: { name: string } };
