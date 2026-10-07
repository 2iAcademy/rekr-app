import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService, SYSTEM_USER } from './chat.service';
import type { StreamClient } from './stream-client.provider';

type ChannelState = {
  createdBy?: string;
  frozen?: boolean;
  members?: string[];
};

type ChannelMock = {
  create: jest.Mock;
  addMembers: jest.Mock;
  removeMembers: jest.Mock;
  updatePartial: jest.Mock;
  delete: jest.Mock;
};

/** What `create()` answers: a channel created by the system, by default. */
const createdChannel = ({
  createdBy = SYSTEM_USER.id,
  frozen = false,
  members = ['7'],
}: ChannelState = {}) => ({
  channel: { frozen, created_by: { id: createdBy } },
  members: members.map((id) => ({ user_id: id })),
});

const buildChannel = (state: ChannelState = {}): ChannelMock => ({
  create: jest.fn().mockResolvedValue(createdChannel(state)),
  addMembers: jest.fn().mockResolvedValue({}),
  removeMembers: jest.fn().mockResolvedValue({}),
  updatePartial: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
});

const buildStream = (channel: ChannelMock) => ({
  key: 'public-key',
  upsertUsers: jest.fn().mockResolvedValue({}),
  createToken: jest.fn<string, [string, number?]>((id) => `token-${id}`),
  channel: jest.fn(() => channel),
  deleteUser: jest.fn().mockResolvedValue({}),
});

const profiles = [
  {
    id: 7,
    candidateProfile: { firstName: 'Ada', lastName: 'Lovelace' },
    recruiterProfile: null,
  },
  {
    id: 9,
    candidateProfile: null,
    recruiterProfile: {
      firstName: 'Rita',
      lastName: 'Dupont',
      company: { name: 'Acme' },
    },
  },
];

const buildPrisma = () => ({
  match: { findUnique: jest.fn(), findMany: jest.fn() },
  recruiterProfile: {
    findUnique: jest.fn(),
    // Company 8 employs recruiters 9 and 10.
    findMany: jest.fn().mockResolvedValue([{ userId: 9 }, { userId: 10 }]),
  },
  user: {
    findMany: jest.fn(({ where }: { where: { id: { in: number[] } } }) =>
      Promise.resolve(profiles.filter(({ id }) => where.id.in.includes(id))),
    ),
  },
  company: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme' }) },
  candidateProfile: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace' }),
  },
});

/** A match of candidate 7 on an offer of company 8. */
const matchRow = (status = 'open', isActive = true) => ({
  id: 12,
  candidateUserId: 7,
  offerId: 3,
  candidate: { isActive },
  offer: { companyId: 8, status },
});

describe('ChatService', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let channel: ChannelMock;
  let stream: ReturnType<typeof buildStream>;
  let service: ChatService;

  const build = (client: StreamClient | null) =>
    new ChatService(prisma as unknown as PrismaService, client);

  const asRecruiter = () =>
    prisma.recruiterProfile.findUnique.mockResolvedValue({ companyId: 8 });

  beforeEach(() => {
    prisma = buildPrisma();
    channel = buildChannel();
    stream = buildStream(channel);
    service = build(stream as unknown as StreamClient);
  });

  describe('issueToken', () => {
    it('upserts the caller with a display name and signs a short token', async () => {
      const result = await service.issueToken({ id: 9, userType: 'recruiter' });

      expect(stream.upsertUsers).toHaveBeenCalledWith([
        { id: '9', name: 'Rita Dupont · Acme' },
      ]);
      expect(result).toEqual({
        apiKey: 'public-key',
        userId: '9',
        token: 'token-9',
      });
      const [, expiresAt = 0] = stream.createToken.mock.calls[0];
      expect(expiresAt - Date.now() / 1000).toBeGreaterThan(3500);
      expect(expiresAt - Date.now() / 1000).toBeLessThanOrEqual(3600);
    });

    it('refuses an account without a profile, before touching Stream', async () => {
      await expect(
        service.issueToken({ id: 11, userType: 'recruiter' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(stream.upsertUsers).not.toHaveBeenCalled();
    });

    it('answers 503 when Stream is not configured', async () => {
      await expect(
        build(null).issueToken({ id: 7, userType: 'candidate' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('answers 503 when Stream is down', async () => {
      stream.upsertUsers.mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        service.issueToken({ id: 7, userType: 'candidate' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('openMatchChannel', () => {
    it('opens the channel of the candidate’s own match, created by the system', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());

      const result = await service.openMatchChannel(
        { id: 7, userType: 'candidate' },
        12,
      );

      expect(stream.upsertUsers).toHaveBeenCalledWith([
        SYSTEM_USER,
        { id: '7', name: 'Ada Lovelace' },
      ]);
      expect(stream.channel).toHaveBeenCalledWith('messaging', 'match-12', {
        created_by_id: SYSTEM_USER.id,
        members: ['7'],
      });
      expect(channel.addMembers).not.toHaveBeenCalled();
      expect(channel.removeMembers).not.toHaveBeenCalled();
      expect(result).toEqual({
        channelType: 'messaging',
        channelId: 'match-12',
        counterpartName: 'Acme',
        offerId: 3,
        frozen: false,
      });
    });

    it('adds any recruiter of the company, not only the one who matched', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());
      asRecruiter();

      const result = await service.openMatchChannel(
        { id: 9, userType: 'recruiter' },
        12,
      );

      expect(result.counterpartName).toBe('Ada Lovelace');
      expect(channel.addMembers).toHaveBeenCalledWith(['9']);
    });

    it('adds the candidate back when they are missing from the channel', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());
      asRecruiter();
      channel.create.mockResolvedValue(createdChannel({ members: ['10'] }));

      await service.openMatchChannel({ id: 9, userType: 'recruiter' }, 12);

      expect(channel.addMembers).toHaveBeenCalledWith(['7', '9']);
    });

    it('removes members who are no party to the match', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());
      channel.create.mockResolvedValue(
        createdChannel({ members: ['7', '9', '666'] }),
      );

      await service.openMatchChannel({ id: 7, userType: 'candidate' }, 12);

      expect(channel.removeMembers).toHaveBeenCalledWith(['666']);
    });

    it('rebuilds a channel someone created ahead of the match', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());
      channel.create
        .mockResolvedValueOnce(
          createdChannel({ createdBy: '666', members: ['666'] }),
        )
        .mockResolvedValueOnce(createdChannel({ members: ['7'] }));

      await service.openMatchChannel({ id: 7, userType: 'candidate' }, 12);

      expect(channel.delete).toHaveBeenCalledWith({ hard_delete: true });
      expect(channel.create).toHaveBeenCalledTimes(2);
      expect(channel.removeMembers).not.toHaveBeenCalled();
    });

    it.each([
      ['another candidate', { id: 8, userType: 'candidate' as const }, null],
      [
        'a recruiter of another company',
        { id: 9, userType: 'recruiter' as const },
        { companyId: 99 },
      ],
    ])(
      'answers 404 to %s, before touching Stream',
      async (_, user, profile) => {
        prisma.match.findUnique.mockResolvedValue(matchRow());
        prisma.recruiterProfile.findUnique.mockResolvedValue(profile);

        await expect(service.openMatchChannel(user, 12)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(stream.channel).not.toHaveBeenCalled();
      },
    );

    it('answers 404 to a recruiter when the candidate is deactivated', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow('open', false));
      asRecruiter();

      await expect(
        service.openMatchChannel({ id: 9, userType: 'recruiter' }, 12),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stream.channel).not.toHaveBeenCalled();
    });

    it('answers 503 when Stream is down', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow());
      channel.create.mockRejectedValue(new Error('timeout'));

      await expect(
        service.openMatchChannel({ id: 7, userType: 'candidate' }, 12),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it.each([
      ['filled', false, true],
      ['closed', false, true],
      ['draft', false, true],
      ['open', true, false],
      ['paused', true, false],
    ])(
      'reconciles the freeze of an offer that is %s',
      async (status, wasFrozen, frozen) => {
        prisma.match.findUnique.mockResolvedValue(matchRow(status));
        channel.create.mockResolvedValue(createdChannel({ frozen: wasFrozen }));

        const result = await service.openMatchChannel(
          { id: 7, userType: 'candidate' },
          12,
        );

        expect(channel.updatePartial).toHaveBeenCalledWith({
          set: { frozen },
        });
        expect(result.frozen).toBe(frozen);
      },
    );

    it('leaves a channel already in the right state alone', async () => {
      prisma.match.findUnique.mockResolvedValue(matchRow('closed'));
      channel.create.mockResolvedValue(createdChannel({ frozen: true }));

      await service.openMatchChannel({ id: 7, userType: 'candidate' }, 12);

      expect(channel.updatePartial).not.toHaveBeenCalled();
    });
  });

  describe('syncOfferStatus', () => {
    it('freezes every conversation of an offer that gets filled', async () => {
      prisma.match.findMany.mockResolvedValue([{ id: 12 }, { id: 13 }]);

      await service.syncOfferStatus(3, 'filled');

      expect(stream.channel).toHaveBeenCalledWith('messaging', 'match-12');
      expect(stream.channel).toHaveBeenCalledWith('messaging', 'match-13');
      expect(channel.updatePartial).toHaveBeenCalledTimes(2);
      expect(channel.updatePartial).toHaveBeenCalledWith({
        set: { frozen: true },
      });
    });

    it('thaws them when the offer reopens', async () => {
      prisma.match.findMany.mockResolvedValue([{ id: 12 }]);

      await service.syncOfferStatus(3, 'open');

      expect(channel.updatePartial).toHaveBeenCalledWith({
        set: { frozen: false },
      });
    });

    it('never has more than ten calls in flight', async () => {
      prisma.match.findMany.mockResolvedValue(
        Array.from({ length: 25 }, (_, index) => ({ id: index + 1 })),
      );
      let inFlight = 0;
      let peak = 0;
      channel.updatePartial.mockImplementation(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight -= 1;
      });

      await service.syncOfferStatus(3, 'closed');

      expect(channel.updatePartial).toHaveBeenCalledTimes(25);
      expect(peak).toBeLessThanOrEqual(10);
    });

    it('swallows a Stream failure: the status change is already committed', async () => {
      prisma.match.findMany.mockResolvedValue([{ id: 12 }]);
      channel.updatePartial.mockRejectedValue(new Error('channel not found'));

      await expect(service.syncOfferStatus(3, 'closed')).resolves.toBe(
        undefined,
      );
    });

    it('does nothing when Stream is not configured', async () => {
      await build(null).syncOfferStatus(3, 'closed');

      expect(prisma.match.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteMatchChannels and eraseUser', () => {
    it('hard-deletes each conversation', async () => {
      await service.deleteMatchChannels([12, 13]);

      expect(channel.delete).toHaveBeenCalledTimes(2);
      expect(channel.delete).toHaveBeenCalledWith({ hard_delete: true });
    });

    it('swallows a Stream failure on deletion', async () => {
      channel.delete.mockRejectedValue(new Error('timeout'));

      await expect(service.deleteMatchChannels([12])).resolves.toBe(undefined);
    });

    it('erases the user and their messages at Stream', async () => {
      await service.eraseUser(7);

      expect(stream.deleteUser).toHaveBeenCalledWith('7', {
        hard_delete: true,
        mark_messages_deleted: true,
      });
    });
  });
});
