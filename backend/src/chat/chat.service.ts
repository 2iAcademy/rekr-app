import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ChannelAPIResponse, UserResponse } from 'stream-chat';
import type { OfferStatus } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
import { findMatchInScope, type MatchInScope } from '../match/match-scope';
import { PrismaService } from '../prisma/prisma.service';
import { ChatTokenDto } from './dto/chat-token.dto';
import { MatchChannelDto } from './dto/match-channel.dto';
import { STREAM_CLIENT, type StreamClient } from './stream-client.provider';

export const CHANNEL_TYPE = 'messaging';

/**
 * An offer no longer published keeps its conversations readable, not
 * writable. A paused one is only on hold, so its conversations go on.
 */
const FROZEN_STATUSES: readonly OfferStatus[] = ['draft', 'filled', 'closed'];

/**
 * The creator of every channel. A channel created by a person makes that
 * person its owner at Stream, with the right to add whoever they like; and a
 * channel a person created ahead of a match, guessing its sequential id,
 * would be the one the match later opens.
 */
export const SYSTEM_USER: UserResponse = { id: 'rekr-system', name: 'Rekr' };

/** Calls sent to Stream at once, so a large offer does not burst its quota. */
const STREAM_BATCH_SIZE = 10;

/**
 * A Stream token outlives nothing on our side — not a logout, not a
 * deactivation — so it is kept short, and the client asks for a new one.
 */
const TOKEN_TTL_SECONDS = 60 * 60;

export const channelIdOf = (matchId: number): string => `match-${matchId}`;

const isFrozenStatus = (status: OfferStatus): boolean =>
  FROZEN_STATUSES.includes(status);

/**
 * Conversations live at Stream, access is decided here.
 *
 * Every channel is opened by `openMatchChannel` once `findMatchInScope` has
 * said yes, and each opening puts its members back in line with the database,
 * so the code does not rely on the Stream dashboard alone to keep people out.
 * Everything that ends a match outside that path — unmatch, account erasure —
 * deletes the channel afterwards, on a best-effort basis: the database is the
 * source of truth, and a provider outage must not roll back what the user
 * asked for.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STREAM_CLIENT) private readonly stream: StreamClient | null,
  ) {}

  async issueToken(user: AuthUser): Promise<ChatTokenDto> {
    const stream = this.requireStream();
    // Without a profile there is no match to talk about, and nothing to show
    // at Stream but a placeholder name.
    const [streamUser] = await this.streamUsers([user.id]);
    if (!streamUser)
      throw new ForbiddenException('Messaging requires a completed profile.');
    // Display names are refreshed on every token, so a renamed profile shows
    // up at the next connection.
    await this.reach(() => stream.upsertUsers([streamUser]));
    return {
      apiKey: stream.key,
      userId: streamUser.id,
      token: stream.createToken(
        streamUser.id,
        Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      ),
    };
  }

  async openMatchChannel(
    user: AuthUser,
    matchId: number,
  ): Promise<MatchChannelDto> {
    const stream = this.requireStream();
    const match = await findMatchInScope(this.prisma, user, matchId);
    const allowed = await this.allowedMembers(match);
    const people = await this.streamUsers([match.candidateUserId, user.id]);

    const channelId = channelIdOf(match.id);
    const frozen = isFrozenStatus(match.offer.status);
    await this.reach(() =>
      this.syncChannel(stream, channelId, {
        people,
        allowed,
        required: [String(match.candidateUserId), String(user.id)],
        frozen,
      }),
    );

    return {
      channelType: CHANNEL_TYPE,
      channelId,
      counterpartName: await this.counterpartName(user, match),
      offerId: match.offerId,
      frozen,
    };
  }

  /** Freezes or thaws the conversations of an offer whose status changed. */
  async syncOfferStatus(offerId: number, status: OfferStatus): Promise<void> {
    const stream = this.stream;
    if (!stream) return;
    const frozen = isFrozenStatus(status);
    const matches = await this.prisma.match.findMany({
      where: { offerId },
      select: { id: true },
    });
    // Channels nobody opened do not exist at Stream and fail here; that is
    // expected, and `openMatchChannel` applies the status when they are.
    await this.settle(
      `${frozen ? 'freeze' : 'thaw'} conversations of offer ${offerId}`,
      matches.map(
        ({ id }) =>
          () =>
            stream
              .channel(CHANNEL_TYPE, channelIdOf(id))
              .updatePartial({ set: { frozen } }),
      ),
    );
  }

  async deleteMatchChannels(matchIds: readonly number[]): Promise<void> {
    const stream = this.stream;
    if (!stream || matchIds.length === 0) return;
    await this.settle(
      `delete ${matchIds.length} conversation(s)`,
      matchIds.map(
        (id) => () =>
          stream
            .channel(CHANNEL_TYPE, channelIdOf(id))
            .delete({ hard_delete: true }),
      ),
    );
  }

  /** Erasure at Stream: the user and every message they wrote. */
  async eraseUser(userId: number): Promise<void> {
    const stream = this.stream;
    if (!stream) return;
    await this.settle(`erase user ${userId}`, [
      () =>
        stream.deleteUser(String(userId), {
          hard_delete: true,
          mark_messages_deleted: true,
        }),
    ]);
  }

  /**
   * Creates the channel if needed, then puts it back in line: created by the
   * system, holding the candidate and the caller, nobody outside the match,
   * frozen as the offer's status says. Re-applied on every opening, so a
   * freeze or a deletion that failed earlier is corrected the next time
   * anyone looks.
   */
  private async syncChannel(
    stream: StreamClient,
    channelId: string,
    target: {
      people: UserResponse[];
      allowed: ReadonlySet<string>;
      required: string[];
      frozen: boolean;
    },
  ): Promise<void> {
    // Stream refuses a member it has never heard of, and the candidate may
    // not have connected yet.
    await stream.upsertUsers([SYSTEM_USER, ...target.people]);
    const open = () =>
      stream
        .channel(CHANNEL_TYPE, channelId, {
          created_by_id: SYSTEM_USER.id,
          members: [...new Set(target.required)],
        })
        .create();

    // Idempotent: answers the existing channel when there is one, and then
    // ignores the members passed above.
    let state: ChannelAPIResponse = await open();
    if (state.channel.created_by?.id !== SYSTEM_USER.id) {
      // Not created through this path, so nothing in it can be trusted —
      // neither its members nor what was written there before the match.
      await stream
        .channel(CHANNEL_TYPE, channelId)
        .delete({ hard_delete: true });
      state = await open();
    }

    const channel = stream.channel(CHANNEL_TYPE, channelId);
    const present = new Set(
      state.members.map((member) => member.user_id ?? member.user?.id),
    );
    const intruders = [...present].filter(
      (id): id is string => !!id && !target.allowed.has(id),
    );
    if (intruders.length > 0) await channel.removeMembers(intruders);
    // How a colleague of the recruiter who matched joins the conversation.
    const missing = target.required.filter((id) => !present.has(id));
    if (missing.length > 0) await channel.addMembers([...new Set(missing)]);

    if (Boolean(state.channel.frozen) !== target.frozen)
      await channel.updatePartial({ set: { frozen: target.frozen } });
  }

  /** The candidate and every recruiter of the offer's company. */
  private async allowedMembers(match: MatchInScope): Promise<Set<string>> {
    const recruiters = await this.prisma.recruiterProfile.findMany({
      where: { companyId: match.offer.companyId },
      select: { userId: true },
    });
    return new Set([
      String(match.candidateUserId),
      ...recruiters.map(({ userId }) => String(userId)),
    ]);
  }

  /** Same counterpart as the matches list: the company, or the candidate. */
  private async counterpartName(
    user: AuthUser,
    match: MatchInScope,
  ): Promise<string> {
    if (user.userType === 'candidate') {
      const company = await this.prisma.company.findUnique({
        where: { id: match.offer.companyId },
        select: { name: true },
      });
      return company?.name ?? 'Entreprise';
    }
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId: match.candidateUserId },
      select: { firstName: true, lastName: true },
    });
    return profile ? `${profile.firstName} ${profile.lastName}` : 'Candidat';
  }

  private requireStream(): StreamClient {
    if (!this.stream)
      throw new ServiceUnavailableException('Messaging is not configured.');
    return this.stream;
  }

  /** A provider outage is a 503 for the caller, not an internal error. */
  private async reach<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (cause) {
      this.logger.warn(
        `Stream unreachable: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      throw new ServiceUnavailableException('Messaging is unavailable.');
    }
  }

  /** Users without a profile are left out: they have nothing to show. */
  private async streamUsers(userIds: number[]): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        candidateProfile: { select: { firstName: true, lastName: true } },
        recruiterProfile: {
          select: {
            firstName: true,
            lastName: true,
            company: { select: { name: true } },
          },
        },
      },
    });
    return [...new Set(userIds)].flatMap((id) => {
      const user = users.find((candidate) => candidate.id === id);
      const candidate = user?.candidateProfile;
      const recruiter = user?.recruiterProfile;
      // Names only: avatars are storage keys served behind the API, which a
      // Stream client could not fetch. The UI falls back to initials.
      if (candidate)
        return [
          {
            id: String(id),
            name: `${candidate.firstName} ${candidate.lastName}`,
          },
        ];
      if (recruiter)
        return [
          {
            id: String(id),
            name: `${recruiter.firstName} ${recruiter.lastName} · ${recruiter.company.name}`,
          },
        ];
      return [];
    });
  }

  private async settle(
    what: string,
    calls: Array<() => Promise<unknown>>,
  ): Promise<void> {
    const results: PromiseSettledResult<unknown>[] = [];
    for (let start = 0; start < calls.length; start += STREAM_BATCH_SIZE) {
      const batch = calls.slice(start, start + STREAM_BATCH_SIZE);
      results.push(...(await Promise.allSettled(batch.map((call) => call()))));
    }
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length === 0) return;
    const reason: unknown = failures[0].reason;
    this.logger.warn(
      `Stream: ${failures.length}/${calls.length} call(s) failed to ${what}. ` +
        (reason instanceof Error ? reason.message : String(reason)),
    );
  }
}
