import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { KafkaLogPublisherService } from '../src/kafka/kafka-log-publisher.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

/**
 * Bypasses found by the adversarial verifiers on the M1 / M4 / M5 fixes.
 *
 * Every test here is an attack: it must fail against the code as it stood at
 * the end of the green phase, and pass once the bypass is closed. The two
 * exceptions are explicitly labelled NON-REGRESSION — they lock behaviour the
 * verifiers probed and could NOT break, so that a later change cannot silently
 * open it.
 *
 * The Kafka publisher is stubbed: these tests assert the HTTP boundary
 * (authorization + validation), not broker delivery, and no broker runs here.
 */
const BURST = 25;
const HUGE_ARRAY_SIZE = 5000;
const OVERLONG_TEXT_LENGTH = 6000;

jest.setTimeout(120_000);

describe('Security hardening (e2e) — verifier bypasses', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const publish = jest.fn().mockResolvedValue({ stubbed: true });

  const createUser = (userType: 'candidate' | 'recruiter' | 'admin') =>
    prisma.user.create({
      data: {
        email: `${userType}-${Date.now()}-${Math.random()}@test.dev`,
        passwordHash: 'x',
        userType,
      },
    });

  const seedRecruiterWithCompany = async () => {
    const user = await createUser('recruiter');
    const company = await prisma.company.create({ data: { name: 'Acme' } });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName: 'R',
        lastName: 'D',
      },
    });
    return { user, company };
  };

  const labels = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `label-${index}`);

  const overlongText = (): string => 'a'.repeat(OVERLONG_TEXT_LENGTH);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KafkaLogPublisherService)
      .useValue({ topicName: 'logs.raw.test', publish })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
    publish.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * The throttler keys its counters on `req.ip`. With Express `trust proxy`
   * left at its default, a forged `X-Forwarded-For` must not reset anything.
   * NON-REGRESSION: this already held at the end of the green phase; it guards
   * against someone "fixing" the reverse-proxy problem with `trust proxy: true`,
   * which would make the header authoritative and hand the bypass away.
   */
  it('NON-REGRESSION — a forged X-Forwarded-For does not lift the login rate limit', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < BURST; index += 1) {
      const res = await httpRequest(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `1.2.3.${index}`)
        .send({ email: 'victim@test.dev', password: 'wrong-password' });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  describe('/api/logs is authorization-gated, not just authenticated', () => {
    const postLog = (path: string) =>
      httpRequest(app).post(`/api/logs/${path}`);

    it('forbids a plain candidate from injecting a log event (403)', async () => {
      const user = await createUser('candidate');

      await postLog('error')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ message: 'injected by a free account' })
        .expect(403);

      expect(publish).not.toHaveBeenCalled();
    });

    it('forbids a plain recruiter from flooding the sample endpoint (403)', async () => {
      const user = await createUser('recruiter');

      await postLog('sample')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({})
        .expect(403);

      expect(publish).not.toHaveBeenCalled();
    });

    it('still lets an admin exercise the Kafka pipeline (202)', async () => {
      const admin = await createUser('admin');

      await postLog('sample')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({})
        .expect(202);

      expect(publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('control characters never reach Postgres', () => {
    it('rejects a NUL byte in a log message (400) — Kafka poison pill', async () => {
      const admin = await createUser('admin');

      const res = await httpRequest(app)
        .post('/api/logs/error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: '\u0000' });

      expect(res.status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects an escape sequence smuggled into a log message (400)', async () => {
      const admin = await createUser('admin');

      const res = await httpRequest(app)
        .post('/api/logs/error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 'harmless\u001B[2Jwiped' });

      expect(res.status).toBe(400);
      expect(publish).not.toHaveBeenCalled();
    });

    it('keeps accepting a multi-line stack trace in a log message (202)', async () => {
      const admin = await createUser('admin');

      await httpRequest(app)
        .post('/api/logs/error')
        .set('Authorization', bearerFor(app, admin.id, 'admin'))
        .send({ message: 'Error: boom\n\tat foo (bar.ts:1:1)' })
        .expect(202);

      expect(publish).toHaveBeenCalledTimes(1);
    });

    it('rejects a NUL byte in a skill label (400, never 500)', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', skills: ['\u0000'] });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects a NUL byte in an offer benefit label (400, never 500)', async () => {
      const { user } = await seedRecruiterWithCompany();

      const res = await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ title: 'Dev', benefits: ['ok\u0000'] });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });
  });

  describe('tag dictionary cannot be poisoned across categories', () => {
    it('lets a candidate remove a skill whose label was first created as a benefit', async () => {
      const { user: recruiter } = await seedRecruiterWithCompany();
      await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({ title: 'Dev', benefits: ['React'] })
        .expect(201);

      const candidate = await createUser('candidate');
      const authorization = bearerFor(app, candidate.id, 'candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', authorization)
        .send({ firstName: 'Ada', lastName: 'Lovelace', skills: ['React'] })
        .expect(201);

      expect(await prisma.candidateTag.count()).toBe(1);

      await httpRequest(app)
        .patch('/api/candidate-profiles/me')
        .set('Authorization', authorization)
        .send({ skills: [] })
        .expect(200);

      expect(await prisma.candidateTag.count()).toBe(0);
    });

    it('lets a recruiter remove a benefit whose label was first created as a skill', async () => {
      const candidate = await createUser('candidate');
      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, candidate.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', skills: ['Remote'] })
        .expect(201);

      const { user: recruiter } = await seedRecruiterWithCompany();
      const authorization = bearerFor(app, recruiter.id, 'recruiter');

      const created = await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', authorization)
        .send({ title: 'Dev', skills: ['React'], benefits: ['Remote'] })
        .expect(201);
      const offerId = (created.body as { id: number }).id;

      const linkedLabels = async (category: 'skill' | 'benefit') =>
        (
          await prisma.offerTag.findMany({
            where: { offerId, tag: { category } },
            select: { tag: { select: { label: true } } },
          })
        ).map((link) => link.tag.label);

      expect(await linkedLabels('benefit')).toEqual(['Remote']);
      expect(await linkedLabels('skill')).toEqual(['React']);

      await httpRequest(app)
        .patch(`/api/offers/${offerId}`)
        .set('Authorization', authorization)
        .send({ benefits: [] })
        .expect(200);

      // Asserted per category, not on a global count: a wipe scoped on the
      // offer alone would also empty this list and pass a bare `count() === 0`.
      expect(await linkedLabels('benefit')).toEqual([]);
      expect(await linkedLabels('skill')).toEqual(['React']);
    });
  });

  describe('tag labels are normalised before they hit the shared dictionary', () => {
    it('collapses whitespace-padded duplicates and drops blank labels', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          skills: ['React', 'React ', ' React', '   ', '', 'Vue'],
        })
        .expect(201);

      expect(await prisma.tag.count()).toBe(2);
      expect(await prisma.candidateTag.count()).toBe(2);
    });
  });

  describe('free-text fields are bounded', () => {
    it('rejects an overlong candidate bio (400)', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', bio: overlongText() });

      expect(res.status).toBe(400);
      expect(await prisma.candidateProfile.count()).toBe(0);
    });

    it('rejects an overlong company description (400)', async () => {
      const recruiter = await createUser('recruiter');

      const res = await httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, recruiter.id, 'recruiter'))
        .send({
          name: 'Acme',
          firstName: 'R',
          lastName: 'D',
          description: overlongText(),
        });

      expect(res.status).toBe(400);
      expect(await prisma.company.count()).toBe(0);
    });

    it('rejects an overlong offer description (400)', async () => {
      const { user } = await seedRecruiterWithCompany();

      const res = await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ title: 'Dev', description: overlongText() });

      expect(res.status).toBe(400);
      expect(await prisma.offer.count()).toBe(0);
    });
  });

  /**
   * NON-REGRESSION: `PartialType` inherits the validation metadata today, so
   * the PATCH twins of the bounded POST routes are already capped. Only the
   * candidate PATCH was covered; these two close the symmetry so that
   * re-declaring an Update DTO by hand would break a test.
   */
  describe('NON-REGRESSION — PATCH routes inherit the array bounds', () => {
    it('rejects 5000 benefits on an offer update (400)', async () => {
      const { user } = await seedRecruiterWithCompany();
      const authorization = bearerFor(app, user.id, 'recruiter');
      const created = await httpRequest(app)
        .post('/api/offers')
        .set('Authorization', authorization)
        .send({ title: 'Dev' })
        .expect(201);
      const offerId = (created.body as { id: number }).id;

      const res = await httpRequest(app)
        .patch(`/api/offers/${offerId}`)
        .set('Authorization', authorization)
        .send({ benefits: labels(HUGE_ARRAY_SIZE) });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });

    it('rejects 5000 skills on an offer update (400)', async () => {
      const { user, company } = await seedRecruiterWithCompany();
      const offer = await prisma.offer.create({
        data: { title: 'Dev', companyId: company.id, createdById: user.id },
      });

      const res = await httpRequest(app)
        .patch(`/api/offers/${offer.id}`)
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ skills: labels(HUGE_ARRAY_SIZE) });

      expect(res.status).toBe(400);
      expect(await prisma.tag.count()).toBe(0);
    });
  });

  /**
   * `linkedinUrl` and `siteUrl` are the only user-supplied URLs the API accepts
   * today (the other URL columns — picture, cvUrl, logo, coverImage, avatar —
   * are not exposed by any DTO, and `forbidNonWhitelisted` rejects them). Both
   * are read back by a client that will put them in an `<a href>`, so a
   * `javascript:` or `data:` value stored here is a stored XSS waiting for a
   * click. The protocol whitelist is enforced at the write boundary.
   */
  describe('URL fields only accept http and https', () => {
    const HOSTILE_URLS = [
      'javascript:alert(document.domain)',
      'JavaScript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ];

    const postProfile = (userId: number, linkedinUrl: string) =>
      httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, userId, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', linkedinUrl });

    const postCompany = (userId: number, siteUrl: string) =>
      httpRequest(app)
        .post('/api/companies')
        .set('Authorization', bearerFor(app, userId, 'recruiter'))
        .send({ name: 'Acme', firstName: 'R', lastName: 'D', siteUrl });

    it.each(HOSTILE_URLS)(
      'rejects %s as a candidate linkedinUrl (400)',
      async (hostile) => {
        const user = await createUser('candidate');

        const res = await postProfile(user.id, hostile);

        expect(res.status).toBe(400);
        expect(await prisma.candidateProfile.count()).toBe(0);
      },
    );

    it.each(HOSTILE_URLS)(
      'rejects %s as a company siteUrl (400)',
      async (hostile) => {
        const user = await createUser('recruiter');

        const res = await postCompany(user.id, hostile);

        expect(res.status).toBe(400);
        expect(await prisma.company.count()).toBe(0);
      },
    );

    it('rejects a protocol-relative URL that browsers would resolve (400)', async () => {
      const user = await createUser('candidate');

      const res = await postProfile(user.id, '//evil.example/in/ada');

      expect(res.status).toBe(400);
    });

    it('rejects a bare host with no scheme (400)', async () => {
      const user = await createUser('candidate');

      const res = await postProfile(user.id, 'linkedin.com/in/ada');

      expect(res.status).toBe(400);
    });

    it('keeps accepting an ordinary https profile URL', async () => {
      const user = await createUser('candidate');

      await postProfile(user.id, 'https://www.linkedin.com/in/ada').expect(201);
    });

    it('keeps accepting a plain http company site', async () => {
      const user = await createUser('recruiter');

      await postCompany(user.id, 'http://acme.dev').expect(201);
    });

    it('applies the same whitelist on the candidate PATCH', async () => {
      const user = await createUser('candidate');
      const authorization = bearerFor(app, user.id, 'candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', authorization)
        .send({ firstName: 'Ada', lastName: 'Lovelace' })
        .expect(201);

      await httpRequest(app)
        .patch('/api/candidate-profiles/me')
        .set('Authorization', authorization)
        .send({ linkedinUrl: 'javascript:alert(1)' })
        .expect(400);

      const saved = await prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      expect(saved?.linkedinUrl).toBeNull();
    });

    it('applies the same whitelist on the company PATCH', async () => {
      const { user } = await seedRecruiterWithCompany();

      await httpRequest(app)
        .patch('/api/companies/mine')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ siteUrl: 'javascript:alert(1)' })
        .expect(400);
    });

    /**
     * The protocol whitelist alone still lets the authority be spoofed:
     * everything before the `@` in a URL is userinfo, not a host. A profile
     * showing `https://www.linkedin.com@evil.example/in/foo` reads as LinkedIn
     * to the person deciding whether to click, and resolves to `evil.example`.
     * That is the same threat the whitelist exists for, one syntax further on.
     */
    const USERINFO_URLS = [
      'https://www.linkedin.com@evil.example/in/foo',
      'https://user:pass@evil.example',
    ];

    it.each(USERINFO_URLS)(
      'rejects %s, whose real host is hidden behind userinfo (400)',
      async (spoofed) => {
        const user = await createUser('candidate');

        const res = await postProfile(user.id, spoofed);

        expect(res.status).toBe(400);
        expect(await prisma.candidateProfile.count()).toBe(0);
      },
    );

    it.each(USERINFO_URLS)(
      'rejects %s as a company siteUrl too (400)',
      async (spoofed) => {
        const user = await createUser('recruiter');

        const res = await postCompany(user.id, spoofed);

        expect(res.status).toBe(400);
        expect(await prisma.company.count()).toBe(0);
      },
    );
  });

  /**
   * Both URL columns are nullable, and the form that writes them has a text
   * input: clearing it sends `''`, not `null`. Validating the field as a URL
   * without saying what an empty one means turns "I removed my LinkedIn" into
   * a 400 the user cannot act on — the field is optional, yet it can no longer
   * be emptied once set.
   *
   * `''` is normalised to `null` rather than merely tolerated: an empty string
   * in a URL column is a value that is neither absent nor usable, and every
   * reader would then have to test for both.
   */
  describe('URL fields can be cleared', () => {
    it('clears a candidate linkedinUrl sent as an empty string', async () => {
      const user = await createUser('candidate');
      const authorization = bearerFor(app, user.id, 'candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', authorization)
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          linkedinUrl: 'https://www.linkedin.com/in/ada',
        })
        .expect(201);

      await httpRequest(app)
        .patch('/api/candidate-profiles/me')
        .set('Authorization', authorization)
        .send({ linkedinUrl: '' })
        .expect(200);

      const saved = await prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      expect(saved?.linkedinUrl).toBeNull();
    });

    it('clears a company siteUrl sent as an empty string', async () => {
      const { user, company } = await seedRecruiterWithCompany();
      await prisma.company.update({
        where: { id: company.id },
        data: { siteUrl: 'https://acme.dev' },
      });

      await httpRequest(app)
        .patch('/api/companies/mine')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ siteUrl: '' })
        .expect(200);

      const saved = await prisma.company.findUnique({
        where: { id: company.id },
      });
      expect(saved?.siteUrl).toBeNull();
    });

    it('accepts an empty string at creation without storing one', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', linkedinUrl: '' })
        .expect(201);

      const saved = await prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      expect(saved?.linkedinUrl).toBeNull();
    });

    // NON-REGRESSION: an explicit null already worked and must keep working.
    it('still clears a candidate linkedinUrl sent as null', async () => {
      const user = await createUser('candidate');
      const authorization = bearerFor(app, user.id, 'candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', authorization)
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          linkedinUrl: 'https://www.linkedin.com/in/ada',
        })
        .expect(201);

      await httpRequest(app)
        .patch('/api/candidate-profiles/me')
        .set('Authorization', authorization)
        .send({ linkedinUrl: null })
        .expect(200);

      const saved = await prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      expect(saved?.linkedinUrl).toBeNull();
    });

    // A whitespace-only value is the same user intent as an empty field.
    it('treats a whitespace-only URL as a clear, not as a 400', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', linkedinUrl: '   ' })
        .expect(201);

      const saved = await prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      expect(saved?.linkedinUrl).toBeNull();
    });
  });

  /**
   * Numeric fields were bounded below (`@Min(0)`) and not above, over columns
   * that are `int4` and `Decimal(10, 7)`. The Prisma filter now turns the
   * resulting P2020 into a 400 rather than a 500, which is right for the
   * client and wrong as a place to stop: the request still crosses the whole
   * service and opens a transaction before the database refuses it, and the
   * 400 says nothing about which field was at fault.
   *
   * The bound belongs on the DTO. These tests assert the rejection names the
   * offending field, which is what distinguishes "the boundary caught it" from
   * "the database caught it" — both are 400, only one is diagnosable.
   */
  describe('numeric fields are bounded above, at the boundary', () => {
    const expectRejectedField = (body: unknown, field: string): void => {
      const messages = (body as { message?: string[] }).message ?? [];
      expect(messages.join(' | ')).toContain(field);
    };

    it('rejects a candidate salary above the int4 ceiling, naming the field', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          salaryMin: 3_000_000_000,
        });

      expect(res.status).toBe(400);
      expectRejectedField(res.body, 'salaryMin');
      expect(await prisma.candidateProfile.count()).toBe(0);
    });

    it('rejects an offer salary above the int4 ceiling, naming the field', async () => {
      const { user, company } = await seedRecruiterWithCompany();
      const offer = await prisma.offer.create({
        data: { title: 'Dev', companyId: company.id, createdById: user.id },
      });

      const res = await httpRequest(app)
        .patch(`/api/offers/${offer.id}`)
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .send({ salaryMax: 3_000_000_000 });

      expect(res.status).toBe(400);
      expectRejectedField(res.body, 'salaryMax');
    });

    // Coordinates are no longer part of the contract at all: the API derives
    // them from the (city, postal code) pair. Sending them is not an
    // out-of-range value any more, it is an unknown field — which is the
    // stronger guarantee, since a bounded-but-arbitrary pair was enough to
    // display one commune and be matched at another's.
    it.each([
      ['latitude', 45.75],
      ['latitude', 91],
      ['longitude', 4.83],
      ['longitude', 181],
    ])(
      'refuses %s = %s, coordinates are not the client to send',
      async (field, value) => {
        const user = await createUser('candidate');

        const res = await httpRequest(app)
          .post('/api/candidate-profiles')
          .set('Authorization', bearerFor(app, user.id, 'candidate'))
          .send({ firstName: 'Ada', lastName: 'Lovelace', [field]: value });

        expect(res.status).toBe(400);
        expectRejectedField(res.body, field);
        expect(await prisma.candidateProfile.count()).toBe(0);
      },
    );

    it('rejects a mobility radius above the int4 ceiling', async () => {
      const user = await createUser('candidate');

      const res = await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          mobilityRadiusKm: 3_000_000_000,
        });

      expect(res.status).toBe(400);
      expectRejectedField(res.body, 'mobilityRadiusKm');
    });

    it('keeps accepting a real salary and a real mobility radius', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .post('/api/candidate-profiles')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          salaryMin: 45_000,
          salaryMax: 60_000,
          mobilityRadiusKm: 50,
        })
        .expect(201);
    });
  });

  describe('the Sentry debug route is not an anonymous error generator', () => {
    it('rejects GET /api/debug-sentry without a token (401)', async () => {
      await httpRequest(app).get('/api/debug-sentry').expect(401);
    });

    it('forbids a plain candidate from triggering it (403)', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .get('/api/debug-sentry')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(403);
    });
  });
});
