import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpRequest } from './http-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  MAIL_SENDER,
  type MailMessage,
} from '../src/mail/mail-sender.interface';
import { configureApp } from '../src/setup-app';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

const PASSWORD = 'Sup3rSecret!';
const NEW_PASSWORD = 'Nouveau-Mot2Passe!';
const INVALID_LINK = "Ce lien de réinitialisation n'est plus valide.";

describe('Auth password reset (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const sent: MailMessage[] = [];
  const mailSender = {
    send: (message: MailMessage) => {
      sent.push(message);

      return Promise.resolve();
    },
  };

  const signup = (email: string) =>
    httpRequest(app)
      .post('/api/auth/signup')
      .send({ email, password: PASSWORD, userType: 'candidate' });

  const forgot = (email: string) =>
    httpRequest(app).post('/api/auth/password/forgot').send({ email });

  const reset = (token: string, password: string) =>
    httpRequest(app).post('/api/auth/password/reset').send({ token, password });

  const login = (email: string, password: string) =>
    httpRequest(app).post('/api/auth/login').send({ email, password });

  const refreshCookieOf = (res: request.Response): string => {
    const cookies =
      (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    const raw = cookies.find((cookie) => cookie.startsWith('rekr_rt='));
    if (!raw) {
      throw new Error('No refresh cookie in response');
    }

    return raw.split(';')[0];
  };

  /** The endpoint answers before handing the message to the mail sender, so the
   * assertion has to wait for that detached step. */
  const lastLinkToken = async (): Promise<string> => {
    for (let attempt = 0; attempt < 50 && sent.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const match = /token=([\w-]+)/.exec(sent.at(-1)?.text ?? '');
    if (!match) {
      throw new Error('No reset link was e-mailed');
    }

    return match[1];
  };

  const requestLink = async (email: string): Promise<string> => {
    await forgot(email).expect(204);

    return lastLinkToken();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_SENDER)
      .useValue(mailSender)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    sent.length = 0;
    resetThrottler(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 204 and mails a link for a known account', async () => {
    await signup('candidate@test.dev').expect(201);

    const res = await forgot('candidate@test.dev').expect(204);

    expect(res.text).toBe('');
    await lastLinkToken();
    expect(sent[0].to).toBe('candidate@test.dev');
    expect(sent[0].text).toContain('/reinitialiser-mot-de-passe?token=');
  });

  it('resets the password and lets the account back in with the new one', async () => {
    await signup('candidate@test.dev').expect(201);
    const token = await requestLink('candidate@test.dev');

    const res = await reset(token, NEW_PASSWORD).expect(204);
    expect(res.text).toBe('');

    await login('candidate@test.dev', NEW_PASSWORD).expect(200);
    await login('candidate@test.dev', PASSWORD).expect(401);
  });

  it('refuses a link that has already been used', async () => {
    await signup('candidate@test.dev').expect(201);
    const token = await requestLink('candidate@test.dev');
    await reset(token, NEW_PASSWORD).expect(204);

    const res = await reset(token, 'Encore-Un-Autre!').expect(400);

    expect((res.body as { message: string }).message).toBe(INVALID_LINK);
    await login('candidate@test.dev', 'Encore-Un-Autre!').expect(401);
  });

  it('refuses a link past its expiry', async () => {
    await signup('candidate@test.dev').expect(201);
    const token = await requestLink('candidate@test.dev');

    await prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const res = await reset(token, NEW_PASSWORD).expect(400);

    expect((res.body as { message: string }).message).toBe(INVALID_LINK);
  });

  it('refuses a token that was never issued, with the very same message', async () => {
    const res = await reset('jamais-emis', NEW_PASSWORD).expect(400);

    expect((res.body as { message: string }).message).toBe(INVALID_LINK);
  });

  it('answers a known and an unknown address identically', async () => {
    await signup('candidate@test.dev').expect(201);

    const known = await forgot('candidate@test.dev');
    sent.length = 0;
    // The rate-limit counter is the one header that legitimately differs
    // between two successive calls; rewinding it compares like for like.
    resetThrottler(app);
    const unknown = await forgot('personne@test.dev');

    expect(unknown.status).toBe(known.status);
    expect(unknown.text).toBe(known.text);
    expect(headerFingerprint(unknown)).toEqual(headerFingerprint(known));

    // And nothing at all happened behind the identical answer.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sent).toHaveLength(0);
    await expect(prisma.passwordResetToken.count()).resolves.toBe(1);
  });

  it('kills the sessions that were open before the reset', async () => {
    const created = await signup('candidate@test.dev').expect(201);
    const cookie = refreshCookieOf(created);

    await httpRequest(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    const token = await requestLink('candidate@test.dev');
    await reset(token, NEW_PASSWORD).expect(204);

    await httpRequest(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookieOf(created))
      .expect(401);
  });

  /** The refresh cookie is only half of a session: the access token is
   * stateless and would otherwise stay good for its whole window. */
  it('refuses an access token minted before the reset', async () => {
    const created = await signup('candidate@test.dev').expect(201);
    const accessToken = (created.body as { accessToken: string }).accessToken;

    await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // `iat` is second-granular, so the reset has to land in a later second
    // than the token for the comparison to have anything to see. The guard
    // resolves the tie in favour of the token on purpose — see
    // `JwtAuthGuard.predatesPasswordChange`.
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const token = await requestLink('candidate@test.dev');
    await reset(token, NEW_PASSWORD).expect(204);

    await httpRequest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('refuses a link whose account was deactivated after it was issued', async () => {
    await signup('candidate@test.dev').expect(201);
    const token = await requestLink('candidate@test.dev');

    await prisma.user.updateMany({
      where: { email: 'candidate@test.dev' },
      data: { isActive: false },
    });

    const res = await reset(token, NEW_PASSWORD).expect(400);

    expect((res.body as { message: string }).message).toBe(INVALID_LINK);
  });

  it('rejects a password shorter than the signup floor', async () => {
    await signup('candidate@test.dev').expect(201);
    const token = await requestLink('candidate@test.dev');

    await reset(token, 'court').expect(400);
    await login('candidate@test.dev', PASSWORD).expect(200);
  });
});

/** Everything a client could read off the response except what necessarily
 * varies between two calls. */
function headerFingerprint(res: request.Response): Record<string, unknown> {
  const headers = { ...(res.headers as Record<string, unknown>) };
  delete headers.date;

  return headers;
}
