import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { hashPassword } from '../src/auth/password-hash';
import { SYSTEM_USER } from '../src/chat/chat.service';
import { STREAM_CLIENT } from '../src/chat/stream-client.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

type Role = 'candidate' | 'recruiter' | 'admin';
const PASSWORD = 'Correct-horse-42!';

interface FakeChannel {
  createdBy: string;
  members: Set<string>;
  frozen: boolean;
}

/**
 * Stream itself is never called. This fake keeps the channels it is asked to
 * build — creator, members, freeze — so the suite asserts the state the
 * backend leaves behind, records every call, and refuses all of them while
 * `state.failing` simulates an outage.
 */
const buildFakeStream = () => {
  const state = { failing: false };
  const channels = new Map<string, FakeChannel>();
  const outcome = <T>(value: () => T) =>
    state.failing
      ? Promise.reject(new Error('Stream down'))
      : Promise.resolve().then(value);
  const channelCalls = {
    create: jest.fn(),
    addMembers: jest.fn(),
    removeMembers: jest.fn(),
    updatePartial: jest.fn(),
    delete: jest.fn(),
  };
  const stream = {
    key: 'public-key',
    upsertUsers: jest.fn(() => outcome(() => ({}))),
    createToken: jest.fn((id: string) => `token-${id}`),
    deleteUser: jest.fn(() => outcome(() => ({}))),
    channel: jest.fn(
      (
        type: string,
        id: string,
        data?: { created_by_id: string; members: string[] },
      ) => ({
        create: () => {
          channelCalls.create(id);
          return outcome(() => {
            if (!channels.has(id) && data)
              channels.set(id, {
                createdBy: data.created_by_id,
                members: new Set(data.members),
                frozen: false,
              });
            const channel = channels.get(id);
            if (!channel) throw new Error('channel data missing');
            return {
              channel: {
                frozen: channel.frozen,
                created_by: { id: channel.createdBy },
              },
              members: [...channel.members].map((member) => ({
                user_id: member,
              })),
            };
          });
        },
        addMembers: (members: string[]) => {
          channelCalls.addMembers(id, members);
          return outcome(() =>
            members.forEach((member) => channels.get(id)?.members.add(member)),
          );
        },
        removeMembers: (members: string[]) => {
          channelCalls.removeMembers(id, members);
          return outcome(() =>
            members.forEach((member) =>
              channels.get(id)?.members.delete(member),
            ),
          );
        },
        updatePartial: (update: { set: { frozen: boolean } }) => {
          channelCalls.updatePartial(id, update);
          return outcome(() => {
            const channel = channels.get(id);
            if (!channel) throw new Error('channel not found');
            channel.frozen = update.set.frozen;
          });
        },
        delete: (options: unknown) => {
          channelCalls.delete(id, options);
          return outcome(() => channels.delete(id));
        },
      }),
    ),
  };
  const touched = () =>
    stream.upsertUsers.mock.calls.length +
    stream.createToken.mock.calls.length +
    stream.deleteUser.mock.calls.length +
    stream.channel.mock.calls.length;
  return { stream, channels, channelCalls, state, touched };
};

describe('Chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHash: string;
  const { stream, channels, channelCalls, state, touched } = buildFakeStream();

  const createUser = (userType: Role, isActive = true) =>
    prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash,
        userType,
        isActive,
      },
    });

  const createRecruiter = async (companyId: number, isActive = true) => {
    const user = await createUser('recruiter', isActive);
    await prisma.recruiterProfile.create({
      data: { userId: user.id, companyId, firstName: 'Rita', lastName: 'D' },
    });
    return user;
  };

  const createCandidate = async (isActive = true) => {
    const user = await createUser('candidate', isActive);
    await prisma.candidateProfile.create({
      data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
    return user;
  };

  /**
   * A candidate matched on an offer of Acme, whose recruiter has a colleague;
   * a second candidate matched on the same offer; strangers around them.
   */
  const seedMatch = async ({ candidateActive = true } = {}) => {
    const company = await prisma.company.create({ data: { name: 'Acme' } });
    const recruiter = await createRecruiter(company.id);
    const colleague = await createRecruiter(company.id);
    const otherCompany = await prisma.company.create({
      data: { name: 'Globex' },
    });
    const stranger = await createRecruiter(otherCompany.id);
    const companyless = await createUser('recruiter');
    const candidate = await createCandidate(candidateActive);
    const otherCandidate = await createCandidate();
    const offer = await prisma.offer.create({
      data: { title: 'Dev', status: 'open', companyId: company.id },
    });
    const match = await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: offer.id,
        recruiterUserId: recruiter.id,
      },
    });
    const siblingMatch = await prisma.match.create({
      data: {
        candidateUserId: otherCandidate.id,
        offerId: offer.id,
        recruiterUserId: colleague.id,
      },
    });
    return {
      company,
      recruiter,
      colleague,
      stranger,
      companyless,
      candidate,
      otherCandidate,
      offer,
      match,
      siblingMatch,
    };
  };

  const as = (user: { id: number; userType: Role }) =>
    bearerFor(app, user.id, user.userType);

  const openChat = (
    matchId: number | string,
    caller: { id: number; userType: Role },
  ) =>
    httpRequest(app)
      .post(`/api/matches/${matchId}/chat`)
      .set('Authorization', as(caller));

  const membersOf = (matchId: number) =>
    [...(channels.get(`match-${matchId}`)?.members ?? [])].sort();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STREAM_CLIENT)
      .useValue(stream)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
    jest.clearAllMocks();
    channels.clear();
    state.failing = false;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /chat/token', () => {
    it('signs a token for a candidate, named after their profile', async () => {
      const candidate = await createCandidate();

      const response = await httpRequest(app)
        .post('/api/chat/token')
        .set('Authorization', as(candidate))
        .expect(200);

      expect(response.body).toEqual({
        apiKey: 'public-key',
        userId: String(candidate.id),
        token: `token-${candidate.id}`,
      });
      expect(stream.upsertUsers).toHaveBeenCalledWith([
        { id: String(candidate.id), name: 'Ada Lovelace' },
      ]);
    });

    it('signs a token for a recruiter, named after their company', async () => {
      const { recruiter } = await seedMatch();

      await httpRequest(app)
        .post('/api/chat/token')
        .set('Authorization', as(recruiter))
        .expect(200);

      expect(stream.upsertUsers).toHaveBeenCalledWith([
        { id: String(recruiter.id), name: 'Rita D · Acme' },
      ]);
    });

    it('answers 403 to a recruiter without a company, without reaching Stream', async () => {
      const { companyless } = await seedMatch();

      await httpRequest(app)
        .post('/api/chat/token')
        .set('Authorization', as(companyless))
        .expect(403);
      expect(touched()).toBe(0);
    });

    it('answers 403 to an admin and to a deactivated account, without reaching Stream', async () => {
      const admin = await createUser('admin');
      const inactive = await createCandidate(false);

      for (const caller of [admin, inactive]) {
        await httpRequest(app)
          .post('/api/chat/token')
          .set('Authorization', as(caller))
          .expect(403);
      }
      expect(touched()).toBe(0);
    });

    it('answers 401 without a session, or with a token signed by another secret', async () => {
      const candidate = await createCandidate();
      const forged = new JwtService({
        secret: 'not-the-secret-not-the-secret-123',
      }).sign({ userType: 'candidate' }, { subject: String(candidate.id) });

      await httpRequest(app).post('/api/chat/token').expect(401);
      await httpRequest(app)
        .post('/api/chat/token')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
      expect(touched()).toBe(0);
    });

    it('answers 503 when Stream is down', async () => {
      const candidate = await createCandidate();
      state.failing = true;

      await httpRequest(app)
        .post('/api/chat/token')
        .set('Authorization', as(candidate))
        .expect(503);
    });
  });

  describe('POST /matches/:id/chat — who may open the conversation', () => {
    it('lets the matched candidate in, in a channel created by the system', async () => {
      const { candidate, match } = await seedMatch();

      const response = await openChat(match.id, candidate).expect(200);

      expect(response.body).toEqual({
        channelType: 'messaging',
        channelId: `match-${match.id}`,
        counterpartName: 'Acme',
        offerId: match.offerId,
        frozen: false,
      });
      expect(channels.get(`match-${match.id}`)?.createdBy).toBe(SYSTEM_USER.id);
      expect(membersOf(match.id)).toEqual([String(candidate.id)]);
    });

    it('lets the recruiter who matched and a colleague in, as members', async () => {
      const { candidate, recruiter, colleague, match } = await seedMatch();

      const response = await openChat(match.id, colleague).expect(200);
      await openChat(match.id, recruiter).expect(200);

      expect(response.body).toMatchObject({ counterpartName: 'Ada Lovelace' });
      expect(membersOf(match.id)).toEqual(
        [candidate.id, recruiter.id, colleague.id].map(String).sort(),
      );
    });

    it.each(['otherCandidate', 'stranger', 'companyless'] as const)(
      'answers 404 to %s, and never reaches Stream',
      async (who) => {
        const seeded = await seedMatch();

        await openChat(seeded.match.id, seeded[who]).expect(404);

        expect(touched()).toBe(0);
      },
    );

    it('answers 404 to a candidate on another candidate’s match of the same offer', async () => {
      const { candidate, siblingMatch } = await seedMatch();

      await openChat(siblingMatch.id, candidate).expect(404);
      expect(touched()).toBe(0);
    });

    it('answers the same 404 for a match that does not exist', async () => {
      const { candidate } = await seedMatch();

      await openChat(999999, candidate).expect(404);
      expect(touched()).toBe(0);
    });

    it('answers 404 to a recruiter once the candidate is deactivated', async () => {
      const { recruiter, match } = await seedMatch({ candidateActive: false });

      await openChat(match.id, recruiter).expect(404);
      expect(touched()).toBe(0);
    });

    it('answers 403 to an admin and a deactivated recruiter', async () => {
      const { company, match } = await seedMatch();
      const admin = await createUser('admin');
      const inactive = await createRecruiter(company.id, false);

      for (const caller of [admin, inactive])
        await openChat(match.id, caller).expect(403);
      expect(touched()).toBe(0);
    });

    it('answers 401 without a session', async () => {
      const { match } = await seedMatch();

      await httpRequest(app).post(`/api/matches/${match.id}/chat`).expect(401);
    });

    it.each(['abc', '1.5', '2147483648'])(
      'answers 400 to the id %s',
      async (id) => {
        const { candidate } = await seedMatch();

        await openChat(id, candidate).expect(400);
        expect(touched()).toBe(0);
      },
    );

    it('answers 503 when Stream is down', async () => {
      const { candidate, match } = await seedMatch();
      state.failing = true;

      await openChat(match.id, candidate).expect(503);
    });
  });

  describe('POST /matches/:id/chat — what Stream is left with', () => {
    it('rebuilds a channel someone created ahead of the match', async () => {
      const { candidate, stranger, match } = await seedMatch();
      channels.set(`match-${match.id}`, {
        createdBy: String(stranger.id),
        members: new Set([String(stranger.id)]),
        frozen: false,
      });

      await openChat(match.id, candidate).expect(200);

      expect(channels.get(`match-${match.id}`)?.createdBy).toBe(SYSTEM_USER.id);
      expect(membersOf(match.id)).toEqual([String(candidate.id)]);
    });

    it('removes a member who is no party to the match, and adds the candidate back', async () => {
      const { candidate, recruiter, stranger, match } = await seedMatch();
      channels.set(`match-${match.id}`, {
        createdBy: SYSTEM_USER.id,
        members: new Set([String(stranger.id)]),
        frozen: false,
      });

      await openChat(match.id, recruiter).expect(200);

      expect(membersOf(match.id)).toEqual(
        [candidate.id, recruiter.id].map(String).sort(),
      );
    });

    it('opens the conversation of a closed offer read-only', async () => {
      const { candidate, offer, match } = await seedMatch();
      await prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'closed' },
      });

      const response = await openChat(match.id, candidate).expect(200);

      expect(response.body).toMatchObject({ frozen: true });
      expect(channels.get(`match-${match.id}`)?.frozen).toBe(true);
    });
  });

  describe('DELETE /matches/:id', () => {
    it('deletes the channel when either party undoes the match', async () => {
      const { candidate, colleague, match, siblingMatch, otherCandidate } =
        await seedMatch();

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', as(candidate))
        .expect(204);
      await httpRequest(app)
        .delete(`/api/matches/${siblingMatch.id}`)
        .set('Authorization', as(colleague))
        .expect(204);

      expect(channelCalls.delete.mock.calls).toEqual([
        [`match-${match.id}`, { hard_delete: true }],
        [`match-${siblingMatch.id}`, { hard_delete: true }],
      ]);
      await openChat(siblingMatch.id, otherCandidate).expect(404);
    });

    it('touches no channel when a stranger is refused', async () => {
      const { stranger, match } = await seedMatch();

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', as(stranger))
        .expect(404);

      expect(touched()).toBe(0);
      expect(await prisma.match.count({ where: { id: match.id } })).toBe(1);
    });

    it('answers 404 to a recruiter once the candidate is deactivated, and keeps the conversation', async () => {
      const { recruiter, match } = await seedMatch({ candidateActive: false });

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', as(recruiter))
        .expect(404);

      expect(channelCalls.delete).not.toHaveBeenCalled();
      expect(await prisma.match.count({ where: { id: match.id } })).toBe(1);
    });

    it('still undoes the match when Stream is down', async () => {
      const { candidate, match } = await seedMatch();
      state.failing = true;

      await httpRequest(app)
        .delete(`/api/matches/${match.id}`)
        .set('Authorization', as(candidate))
        .expect(204);

      expect(await prisma.match.count({ where: { id: match.id } })).toBe(0);
    });
  });

  describe('PATCH /offers/:id — freezing', () => {
    const patch = (
      offerId: number,
      caller: { id: number; userType: Role },
      body: object,
    ) =>
      httpRequest(app)
        .patch(`/api/offers/${offerId}`)
        .set('Authorization', as(caller))
        .send(body);

    it.each(['filled', 'closed', 'draft'])(
      'freezes the conversations of an offer that gets %s',
      async (status) => {
        const { candidate, recruiter, offer, match } = await seedMatch();
        await openChat(match.id, candidate).expect(200);

        await patch(offer.id, recruiter, { status }).expect(200);

        expect(channels.get(`match-${match.id}`)?.frozen).toBe(true);
      },
    );

    it('thaws them when the offer reopens', async () => {
      const { candidate, recruiter, offer, match } = await seedMatch();
      await openChat(match.id, candidate).expect(200);
      await patch(offer.id, recruiter, { status: 'closed' }).expect(200);

      await patch(offer.id, recruiter, { status: 'open' }).expect(200);

      expect(channels.get(`match-${match.id}`)?.frozen).toBe(false);
    });

    it.each([{ status: 'open' }, { title: 'Dev senior' }])(
      'asks nothing of Stream when the status does not change (%o)',
      async (body) => {
        const { recruiter, offer } = await seedMatch();

        await patch(offer.id, recruiter, body).expect(200);

        expect(touched()).toBe(0);
      },
    );

    it('freezes nothing for a recruiter of another company, nor for an invalid body', async () => {
      const { stranger, recruiter, offer } = await seedMatch();

      await patch(offer.id, stranger, { status: 'filled' }).expect(404);
      await patch(offer.id, recruiter, { status: 'bogus' }).expect(400);
      await patch(offer.id, recruiter, { status: 'filled', foo: 1 }).expect(
        400,
      );

      expect(touched()).toBe(0);
    });

    it('commits the status even when Stream is down', async () => {
      const { recruiter, offer } = await seedMatch();
      state.failing = true;

      await patch(offer.id, recruiter, { status: 'filled' }).expect(200);

      expect(
        (await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } }))
          .status,
      ).toBe('filled');
    });
  });

  describe('DELETE /account — conversations', () => {
    const erase = (
      caller: { id: number; userType: Role },
      password = PASSWORD,
    ) =>
      httpRequest(app)
        .delete('/api/account')
        .set('Authorization', as(caller))
        .send({ password });

    it('deletes exactly the candidate’s conversations, and the candidate at Stream', async () => {
      const { candidate, match } = await seedMatch();

      await erase(candidate).expect(204);

      expect(channelCalls.delete.mock.calls).toEqual([
        [`match-${match.id}`, { hard_delete: true }],
      ]);
      expect(stream.deleteUser).toHaveBeenCalledWith(String(candidate.id), {
        hard_delete: true,
        mark_messages_deleted: true,
      });
    });

    it('keeps the conversations of a company a recruiter leaves to colleagues', async () => {
      const { recruiter } = await seedMatch();

      await erase(recruiter).expect(204);

      expect(channelCalls.delete).not.toHaveBeenCalled();
      expect(stream.deleteUser).toHaveBeenCalledWith(
        String(recruiter.id),
        expect.anything(),
      );
    });

    it('deletes every conversation of the company its last recruiter takes down', async () => {
      const { recruiter, colleague, match, siblingMatch } = await seedMatch();
      await erase(colleague).expect(204);
      jest.clearAllMocks();

      await erase(recruiter).expect(204);

      expect(
        channelCalls.delete.mock.calls.map(([id]) => id as string).sort(),
      ).toEqual([`match-${match.id}`, `match-${siblingMatch.id}`].sort());
    });

    it('asks nothing of Stream on a wrong password', async () => {
      const { candidate } = await seedMatch();

      await erase(candidate, 'wrong-password').expect(403);

      expect(touched()).toBe(0);
    });

    it('erases the account even when Stream is down', async () => {
      const { candidate } = await seedMatch();
      state.failing = true;

      await erase(candidate).expect(204);

      expect(await prisma.user.count({ where: { id: candidate.id } })).toBe(0);
    });
  });
});

describe('Chat (e2e) — Stream not configured', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STREAM_CLIENT)
      .useValue(null)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 503 on the chat routes, and leaves unmatch and offer updates working', async () => {
    const company = await prisma.company.create({ data: { name: 'Acme' } });
    const recruiter = await prisma.user.create({
      data: { email: 'r@test.dev', passwordHash: 'x', userType: 'recruiter' },
    });
    await prisma.recruiterProfile.create({
      data: {
        userId: recruiter.id,
        companyId: company.id,
        firstName: 'R',
        lastName: 'D',
      },
    });
    const candidate = await prisma.user.create({
      data: { email: 'c@test.dev', passwordHash: 'x', userType: 'candidate' },
    });
    const offer = await prisma.offer.create({
      data: { title: 'Dev', status: 'open', companyId: company.id },
    });
    const match = await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: offer.id,
        recruiterUserId: recruiter.id,
      },
    });
    const asCandidate = bearerFor(app, candidate.id, 'candidate');
    const asRecruiter = bearerFor(app, recruiter.id, 'recruiter');

    await httpRequest(app)
      .post('/api/chat/token')
      .set('Authorization', asCandidate)
      .expect(503);
    await httpRequest(app)
      .post(`/api/matches/${match.id}/chat`)
      .set('Authorization', asCandidate)
      .expect(503);
    await httpRequest(app)
      .patch(`/api/offers/${offer.id}`)
      .set('Authorization', asRecruiter)
      .send({ status: 'filled' })
      .expect(200);
    await httpRequest(app)
      .delete(`/api/matches/${match.id}`)
      .set('Authorization', asCandidate)
      .expect(204);
  });
});
