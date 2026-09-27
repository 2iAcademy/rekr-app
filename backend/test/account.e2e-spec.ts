import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { hashPassword } from '../src/auth/password-hash';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { pdfBuffer, pngBuffer } from './file-fixtures';
import { httpRequest } from './http-client';
import { jobFamilyIdFor } from './job-family-reference';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../src/storage/file-storage.interface';
import { buildStorageKey } from '../src/storage/storage-key';

const UPLOADS_ROOT = process.env.UPLOADS_DIR as string;
const PASSWORD = 'Sup3rSecret!';

/** Every file left under a scope, whatever its owner: a deletion that forgot
 * one is visible here even when the key was never read back from a row. */
const storedFiles = async (scope: string): Promise<string[]> => {
  try {
    return await readdir(join(UPLOADS_ROOT, scope), { recursive: true });
  } catch {
    return [];
  }
};

const cookiesOf = (res: request.Response): string[] =>
  (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

describe('Account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHash: string;

  type Member = {
    id: number;
    email: string;
    userType: 'candidate' | 'recruiter';
  };

  const createUser = async (
    userType: 'candidate' | 'recruiter',
  ): Promise<Member> => {
    const { id, email } = await prisma.user.create({
      data: {
        email: [userType, Date.now(), Math.random()].join('-') + '@test.dev',
        passwordHash,
        userType,
      },
    });
    return { id, email, userType };
  };

  const createCandidate = async () => {
    const user = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        salaryMin: 45000,
      },
    });
    return user;
  };

  const createRecruiter = async (companyId?: number) => {
    const user = await createUser('recruiter');
    const company = companyId
      ? await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
      : await prisma.company.create({ data: { name: 'Acme' } });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName: 'Rick',
        lastName: 'Deckard',
      },
    });
    return { user, company };
  };

  const createOffer = async (companyId: number, createdById: number) =>
    prisma.offer.create({
      data: {
        companyId,
        createdById,
        title: 'Développeuse back',
        status: 'open',
        jobFamilyId: await jobFamilyIdFor(prisma),
      },
    });

  const as = (user: Member) => bearerFor(app, user.id, user.userType);

  const deleteAccount = (user: Member, body: object = { password: PASSWORD }) =>
    httpRequest(app)
      .delete('/api/account')
      .set('Authorization', as(user))
      .send(body);

  /** A candidate liked by, matched with, and passed by the recruiter side. */
  const seedCandidateWithActivity = async () => {
    const candidate = await createCandidate();
    const recruiter = await createRecruiter();
    const offer = await createOffer(recruiter.company.id, recruiter.user.id);
    const tag = await prisma.tag.create({
      data: { label: 'TypeScript', category: 'tech' },
    });

    await prisma.candidateTag.create({
      data: { candidateUserId: candidate.id, tagId: tag.id },
    });
    await prisma.candidateJobFamily.create({
      data: {
        candidateUserId: candidate.id,
        jobFamilyId: await jobFamilyIdFor(prisma),
      },
    });
    await prisma.candidateLikesOffer.create({
      data: { candidateUserId: candidate.id, offerId: offer.id },
    });
    await prisma.recruiterLikesCandidate.create({
      data: {
        recruiterUserId: recruiter.user.id,
        candidateUserId: candidate.id,
        offerId: offer.id,
      },
    });
    await prisma.match.create({
      data: {
        candidateUserId: candidate.id,
        offerId: offer.id,
        recruiterUserId: recruiter.user.id,
      },
    });

    return { candidate, recruiter, offer, tag };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    await rm(UPLOADS_ROOT, { recursive: true, force: true });
    resetThrottler(app);
  });

  afterAll(async () => {
    await rm(UPLOADS_ROOT, { recursive: true, force: true });
    await app.close();
  });

  describe('DELETE /api/account', () => {
    it('rejects an anonymous call with 401', async () => {
      await httpRequest(app)
        .delete('/api/account')
        .send({ password: PASSWORD })
        .expect(401);
    });

    it('refuses a call that does not repeat the password (400)', async () => {
      const candidate = await createCandidate();

      await deleteAccount(candidate, {}).expect(400);

      expect(await prisma.user.count({ where: { id: candidate.id } })).toBe(1);
    });

    /**
     * 403 and not 401: the client reads a 401 as an expired session, refreshes
     * and replays the request — a wrong password would then be sent twice and
     * reported as a logout.
     */
    it('refuses a wrong password with 403 and deletes nothing', async () => {
      const candidate = await createCandidate();

      await deleteAccount(candidate, { password: 'not-the-password' }).expect(
        403,
      );

      expect(await prisma.user.count({ where: { id: candidate.id } })).toBe(1);
    });

    it('erases a candidate, everything attached to them, and their files', async () => {
      const { candidate, recruiter, offer, tag } =
        await seedCandidateWithActivity();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', as(candidate))
        .attach('file', pngBuffer(), 'photo.png')
        .expect(200);
      await httpRequest(app)
        .put('/api/candidate-profiles/me/cv')
        .set('Authorization', as(candidate))
        .attach('file', pdfBuffer(), 'cv.pdf')
        .expect(200);
      expect(await storedFiles('candidates')).not.toEqual([]);

      await deleteAccount(candidate).expect(204);

      expect(await prisma.user.count({ where: { id: candidate.id } })).toBe(0);
      expect(
        await prisma.candidateProfile.count({
          where: { userId: candidate.id },
        }),
      ).toBe(0);
      expect(
        await prisma.candidateTag.count({
          where: { candidateUserId: candidate.id },
        }),
      ).toBe(0);
      expect(
        await prisma.candidateJobFamily.count({
          where: { candidateUserId: candidate.id },
        }),
      ).toBe(0);
      expect(
        await prisma.candidateLikesOffer.count({
          where: { candidateUserId: candidate.id },
        }),
      ).toBe(0);
      expect(
        await prisma.recruiterLikesCandidate.count({
          where: { candidateUserId: candidate.id },
        }),
      ).toBe(0);
      expect(
        await prisma.match.count({ where: { candidateUserId: candidate.id } }),
      ).toBe(0);
      expect(
        await prisma.refreshToken.count({ where: { userId: candidate.id } }),
      ).toBe(0);
      expect(
        (await storedFiles('candidates')).filter((f) => f.includes('.')),
      ).toEqual([]);

      // The other side of the relation is not the candidate's to erase.
      expect(
        await prisma.user.count({ where: { id: recruiter.user.id } }),
      ).toBe(1);
      expect(await prisma.offer.count({ where: { id: offer.id } })).toBe(1);
      expect(await prisma.tag.count({ where: { id: tag.id } })).toBe(1);
    });

    it('ends every session: the access token, the refresh cookie and the login all stop working', async () => {
      const signup = await httpRequest(app)
        .post('/api/auth/signup')
        .send({
          email: 'leaving@test.dev',
          password: PASSWORD,
          userType: 'candidate',
          acceptTerms: true,
        })
        .expect(201);
      const { accessToken } = signup.body as { accessToken: string };
      const refreshCookie = cookiesOf(signup)
        .find((cookie) => cookie.startsWith('rekr_rt='))!
        .split(';')[0];

      const deleted = await httpRequest(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: PASSWORD })
        .expect(204);

      expect(
        cookiesOf(deleted).some((cookie) => /^rekr_rt=;/.test(cookie)),
      ).toBe(true);

      await httpRequest(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      await httpRequest(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);
      await httpRequest(app)
        .post('/api/auth/login')
        .send({ email: 'leaving@test.dev', password: PASSWORD })
        .expect(401);
    });

    it('frees the address for a new sign-up', async () => {
      const candidate = await createCandidate();

      await deleteAccount(candidate).expect(204);

      await httpRequest(app)
        .post('/api/auth/signup')
        .send({
          email: candidate.email,
          password: PASSWORD,
          userType: 'candidate',
          acceptTerms: true,
        })
        .expect(201);
    });

    /**
     * Today every recruiter creates their own company, so the last one leaving
     * leaves a company nobody can ever manage again: its offers would stay in
     * the feed, collecting likes no one will answer. It goes with them, and the
     * likes and matches on its offers with it.
     */
    it('erases the company of its last recruiter, with its offers and files', async () => {
      const { candidate, recruiter, offer } = await seedCandidateWithActivity();

      await httpRequest(app)
        .put('/api/companies/mine/logo')
        .set('Authorization', as(recruiter.user))
        .attach('file', pngBuffer(), 'logo.png')
        .expect(200);
      expect(await storedFiles('companies')).not.toEqual([]);

      await deleteAccount(recruiter.user).expect(204);

      expect(
        await prisma.user.count({ where: { id: recruiter.user.id } }),
      ).toBe(0);
      expect(
        await prisma.company.count({ where: { id: recruiter.company.id } }),
      ).toBe(0);
      expect(await prisma.offer.count({ where: { id: offer.id } })).toBe(0);
      expect(await prisma.match.count({ where: { offerId: offer.id } })).toBe(
        0,
      );
      expect(
        (await storedFiles('companies')).filter((f) => f.includes('.')),
      ).toEqual([]);

      // The candidate stays; only what hung on the vanished offer goes.
      expect(await prisma.user.count({ where: { id: candidate.id } })).toBe(1);
    });

    /**
     * A company shared with a colleague is the colleague's too. It stays, and
     * so do its offers and the matches on them — they only lose the name of
     * who wrote them, which the schema already models as nullable.
     */
    it('keeps a company another recruiter still belongs to', async () => {
      const { candidate, recruiter, offer } = await seedCandidateWithActivity();
      const colleague = await createRecruiter(recruiter.company.id);

      await deleteAccount(recruiter.user).expect(204);

      expect(
        await prisma.company.count({ where: { id: recruiter.company.id } }),
      ).toBe(1);
      expect(
        await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } }),
      ).toMatchObject({ createdById: null });
      expect(
        await prisma.match.findUniqueOrThrow({
          where: {
            candidateUserId_offerId: {
              candidateUserId: candidate.id,
              offerId: offer.id,
            },
          },
        }),
      ).toMatchObject({ recruiterUserId: null });
      expect(
        await prisma.recruiterLikesCandidate.count({
          where: { recruiterUserId: recruiter.user.id },
        }),
      ).toBe(0);
      expect(
        await prisma.user.count({ where: { id: colleague.user.id } }),
      ).toBe(1);
    });

    /**
     * Both see the other as a colleague until one of them commits. Without the
     * row lock each would keep the company for the other, and it would be left
     * with nobody to manage it.
     */
    it('erases the company when its two recruiters leave at the same time', async () => {
      const first = await createRecruiter();
      const second = await createRecruiter(first.company.id);
      await createOffer(first.company.id, first.user.id);

      const [a, b] = await Promise.all([
        deleteAccount(first.user),
        deleteAccount(second.user),
      ]);

      expect([a.status, b.status]).toEqual([204, 204]);
      expect(
        await prisma.company.count({ where: { id: first.company.id } }),
      ).toBe(0);
      expect(
        await prisma.offer.count({ where: { companyId: first.company.id } }),
      ).toBe(0);
    });

    it('throttles password guessing: the 6th call in the window is 429, and nothing is deleted', async () => {
      const candidate = await createCandidate();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const res = await deleteAccount(candidate, { password: 'wrong-pw' });
        statuses.push(res.status);
      }

      expect(statuses).toEqual([403, 403, 403, 403, 403, 429]);
      await deleteAccount(candidate).expect(429);
      expect(await prisma.user.count({ where: { id: candidate.id } })).toBe(1);
    });

    /**
     * A file no row points at any more — a replaced picture whose unlink
     * failed — is still the candidate's, and still served to anyone holding
     * its URL. The deletion goes by the owner's directory, not by the row.
     */
    it('also erases the files of the account that no row points at', async () => {
      const candidate = await createCandidate();
      const orphan = buildStorageKey(
        'candidates',
        candidate.id,
        'picture',
        'png',
      );
      await app.get<FileStorage>(FILE_STORAGE).save(orphan, pngBuffer());

      await deleteAccount(candidate).expect(204);

      await httpRequest(app).get(`/api/files/${orphan}`).expect(404);
    });
  });

  describe('GET /api/account/export', () => {
    it('rejects an anonymous call with 401', async () => {
      await httpRequest(app).get('/api/account/export').expect(401);
    });

    it('hands a candidate everything the application holds about them, as a download', async () => {
      const { candidate, offer } = await seedCandidateWithActivity();
      const stranger = await createCandidate();
      await prisma.candidateLikesOffer.create({
        data: { candidateUserId: stranger.id, offerId: offer.id },
      });

      const res = await httpRequest(app)
        .get('/api/account/export')
        .set('Authorization', as(candidate))
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="rekr-export-\d{4}-\d{2}-\d{2}\.json"$/,
      );

      const body = JSON.parse(res.text) as Record<string, unknown>;
      expect(body).toMatchObject({
        account: {
          id: candidate.id,
          email: candidate.email,
          userType: 'candidate',
        },
        candidateProfile: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          salaryMin: 45000,
        },
        tags: [{ label: 'TypeScript', category: 'tech' }],
        jobFamilies: [{ label: 'Informatique' }],
        likesSent: [{ offerId: offer.id, offerTitle: 'Développeuse back' }],
        likesReceived: [{ offerId: offer.id, companyName: 'Acme' }],
        matches: [{ offerId: offer.id, companyName: 'Acme' }],
      });
      expect(body).toHaveProperty('exportedAt');
      expect(body.likesSent).toHaveLength(1);

      // Nothing that is a secret, or that belongs to someone else.
      expect(res.text).not.toContain(passwordHash);
      expect(res.text).not.toContain('passwordHash');
      expect(res.text).not.toContain(stranger.email);
    });

    it('hands a recruiter their profile, company and the offers they wrote', async () => {
      const { candidate, recruiter, offer } = await seedCandidateWithActivity();

      const res = await httpRequest(app)
        .get('/api/account/export')
        .set('Authorization', as(recruiter.user))
        .expect(200);

      const body = JSON.parse(res.text) as Record<string, unknown>;
      expect(body).toMatchObject({
        account: { id: recruiter.user.id, userType: 'recruiter' },
        recruiterProfile: { firstName: 'Rick', lastName: 'Deckard' },
        company: { id: recruiter.company.id, name: 'Acme' },
        offersCreated: [{ id: offer.id, title: 'Développeuse back' }],
        likesSent: [{ offerId: offer.id, candidateUserId: candidate.id }],
      });
      expect(res.text).not.toContain(passwordHash);
      // The candidate's own data is theirs to export, not the recruiter's.
      expect(res.text).not.toContain('Lovelace');
      expect(res.text).not.toContain(candidate.email);
    });
  });
});
