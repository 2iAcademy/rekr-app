import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetToken, User } from '../../generated/prisma/client';
import type { MailMessage } from '../mail/mail-sender.interface';
import { PasswordResetService } from './password-reset.service';
import { verifyPassword } from './password-hash';
import { hashToken } from './token-hash';

const INVALID_LINK = "Ce lien de réinitialisation n'est plus valide.";

const userRow = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'candidate@test.dev',
  passwordHash: 'stored-hash',
  userType: 'candidate',
  role: 'user',
  isActive: true,
  passwordChangedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let users: User[];
  let resetRows: PasswordResetToken[];
  let refreshRevocations: number[];
  let sent: MailMessage[];
  let sendResult: () => Promise<void>;
  let nextId: number;
  let env: Record<string, string>;

  const findResetRow = (tokenHash: string) =>
    resetRows.find((row) => row.tokenHash === tokenHash) ?? null;

  const resetTokenDelegate = {
    create: jest.fn(
      ({
        data,
      }: {
        data: Pick<PasswordResetToken, 'userId' | 'tokenHash' | 'expiresAt'>;
      }) => {
        // Prisma fills the nullable column and the default; the fake must too,
        // or `usedAt: null` would never match a freshly created row.
        const row: PasswordResetToken = {
          id: nextId++,
          usedAt: null,
          createdAt: new Date(),
          ...data,
        };
        resetRows.push(row);

        return Promise.resolve(row);
      },
    ),
    findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) => {
      const row = findResetRow(where.tokenHash);
      if (!row) {
        return Promise.resolve(null);
      }

      // The service reads the account state through the relation rather than
      // in a second query; the fake joins the same way.
      const owner = users.find((user) => user.id === row.userId);

      return Promise.resolve({
        ...row,
        user: { isActive: owner?.isActive ?? false },
      });
    }),
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: { userId?: number; id?: number; usedAt: null };
        data: { usedAt: Date };
      }) => {
        const matched = resetRows.filter(
          (row) =>
            row.usedAt === null &&
            (where.userId === undefined || row.userId === where.userId) &&
            (where.id === undefined || row.id === where.id),
        );
        matched.forEach((row) => (row.usedAt = data.usedAt));

        return Promise.resolve({ count: matched.length });
      },
    ),
  };

  const userDelegate = {
    findUnique: jest.fn(({ where }: { where: { email?: string } }) =>
      Promise.resolve(users.find((user) => user.email === where.email) ?? null),
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: number };
        data: { passwordHash: string; passwordChangedAt: Date };
      }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (user) {
          user.passwordHash = data.passwordHash;
          user.passwordChangedAt = data.passwordChangedAt;
        }

        return Promise.resolve(user);
      },
    ),
  };

  const prisma = {
    user: userDelegate,
    passwordResetToken: resetTokenDelegate,
    $transaction: jest.fn((run: (tx: unknown) => Promise<unknown>) =>
      run({ user: userDelegate, passwordResetToken: resetTokenDelegate }),
    ),
  };

  const refreshTokens = {
    revokeAllForUser: jest.fn((userId: number) => {
      refreshRevocations.push(userId);

      return Promise.resolve();
    }),
  };

  const mail = {
    send: jest.fn((message: MailMessage) => {
      sent.push(message);

      return sendResult();
    }),
  };

  /** The link the last e-mail carried, as the user would click it. */
  const sentToken = (): string => {
    const match = /token=([\w-]+)/.exec(sent.at(-1)?.text ?? '');
    if (!match) {
      throw new Error('No token in the e-mail body');
    }

    return match[1];
  };

  /** `requestReset` returns before the e-mail has been handed over; let the
   * detached delivery run before asserting on it. */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    users = [userRow()];
    resetRows = [];
    refreshRevocations = [];
    sent = [];
    sendResult = () => Promise.resolve();
    nextId = 1;
    env = { APP_URL: 'https://app.rekr.test' };

    jest.clearAllMocks();

    service = new PasswordResetService(
      prisma as never,
      { get: (key: string) => env[key] } as unknown as ConfigService,
      refreshTokens as never,
      mail,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestReset', () => {
    it('issues a single-use token and mails its link to a known account', async () => {
      await service.requestReset('candidate@test.dev');
      await flush();

      expect(resetRows).toHaveLength(1);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('candidate@test.dev');
      expect(sent[0].text).toContain(
        'https://app.rekr.test/reinitialiser-mot-de-passe?token=',
      );
    });

    it('stores only the digest of the token, never the token itself', async () => {
      await service.requestReset('candidate@test.dev');
      await flush();

      expect(resetRows[0].tokenHash).toBe(hashToken(sentToken()));
      expect(resetRows[0].tokenHash).not.toContain(sentToken());
      expect(resetRows[0].tokenHash).toHaveLength(64);
    });

    it('says nothing and does nothing for an unknown address', async () => {
      await expect(
        service.requestReset('nobody@test.dev'),
      ).resolves.toBeUndefined();
      await flush();

      expect(resetRows).toHaveLength(0);
      expect(sent).toHaveLength(0);
    });

    it('says nothing and does nothing for a deactivated account', async () => {
      users = [userRow({ isActive: false })];

      await expect(
        service.requestReset('candidate@test.dev'),
      ).resolves.toBeUndefined();
      await flush();

      expect(resetRows).toHaveLength(0);
      expect(sent).toHaveLength(0);
    });

    it('answers a known and an unknown address exactly alike', async () => {
      const known = await service.requestReset('candidate@test.dev');
      const unknown = await service.requestReset('nobody@test.dev');

      expect(known).toEqual(unknown);
    });

    it('invalidates the requests already in flight for that account', async () => {
      await service.requestReset('candidate@test.dev');
      await flush();
      await service.requestReset('candidate@test.dev');
      await flush();

      expect(resetRows).toHaveLength(2);
      expect(resetRows[0].usedAt).toBeInstanceOf(Date);
      expect(resetRows[1].usedAt).toBeNull();
    });

    it('expires the link an hour out by default', async () => {
      await service.requestReset('candidate@test.dev');
      await flush();

      const ttl = resetRows[0].expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(59 * 60_000);
      expect(ttl).toBeLessThanOrEqual(60 * 60_000);
    });

    it('honours PASSWORD_RESET_TTL_MINUTES', async () => {
      env.PASSWORD_RESET_TTL_MINUTES = '15';

      await service.requestReset('candidate@test.dev');
      await flush();

      const ttl = resetRows[0].expiresAt.getTime() - Date.now();
      expect(ttl).toBeLessThanOrEqual(15 * 60_000);
      expect(sent[0].text).toContain('15 minutes');
    });

    it('reports the same outcome when the mail server refuses the message', async () => {
      sendResult = () => Promise.reject(new Error('SMTP 421'));

      await expect(
        service.requestReset('candidate@test.dev'),
      ).resolves.toBeUndefined();
      await flush();

      expect(resetRows).toHaveLength(1);
    });

    /** Nodemailer copies the raw SMTP reply into the error message, and a
     * rejection names the recipient in it. Logging the error as it comes would
     * put the address of an account someone else asked to reset into the log. */
    it('never names the account when the delivery fails', async () => {
      const logged: string[] = [];
      jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation((message: unknown) => {
          logged.push(String(message));
        });
      sendResult = () =>
        Promise.reject(
          new Error(
            '550 5.1.1 <candidate@test.dev>: Recipient address rejected',
          ),
        );

      await service.requestReset('candidate@test.dev');
      await flush();

      expect(logged).toHaveLength(1);
      expect(logged[0]).not.toContain('candidate@test.dev');
      expect(logged[0]).toContain(
        'Password reset e-mail could not be delivered',
      );
    });

    /** The enumeration oracle this closes: an awaited SMTP round trip would
     * make the known-account branch measurably slower than the unknown one. */
    it('returns without waiting for the delivery to complete', async () => {
      sendResult = () => new Promise<void>(() => undefined);

      await expect(
        service.requestReset('candidate@test.dev'),
      ).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    const issue = async (): Promise<string> => {
      await service.requestReset('candidate@test.dev');
      await flush();

      return sentToken();
    };

    it('sets the new password through the same pipeline as signup', async () => {
      const token = await issue();

      await service.reset(token, 'Nouveau-Mot2Passe!');

      await expect(
        verifyPassword('Nouveau-Mot2Passe!', users[0].passwordHash),
      ).resolves.toBe(true);
    });

    it('burns the token it consumed', async () => {
      const token = await issue();

      await service.reset(token, 'Nouveau-Mot2Passe!');

      expect(resetRows[0].usedAt).toBeInstanceOf(Date);
    });

    it('ends every session the account had open', async () => {
      const token = await issue();

      await service.reset(token, 'Nouveau-Mot2Passe!');

      expect(refreshRevocations).toEqual([1]);
    });

    /** Refresh tokens alone do not end a session: the access token in flight is
     * stateless and lives on for its full window. `JwtAuthGuard` reads this
     * stamp to refuse it, so it has to land with the new hash or not at all. */
    it('stamps the password change alongside the new hash', async () => {
      const token = await issue();
      const before = Date.now();

      await service.reset(token, 'Nouveau-Mot2Passe!');

      const stampedAt = users[0].passwordChangedAt;
      expect(stampedAt).toBeInstanceOf(Date);
      expect(stampedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(userDelegate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          passwordHash: users[0].passwordHash,
          passwordChangedAt: stampedAt,
        },
      });
    });

    /** The account may have been deactivated after the link went out. Answering
     * 204 there would claim a reset that login then refuses. */
    it('rejects a link whose account has since been deactivated', async () => {
      const token = await issue();
      users[0].isActive = false;

      await expect(service.reset(token, 'Nouveau-Mot2Passe!')).rejects.toThrow(
        new BadRequestException(INVALID_LINK),
      );
      expect(users[0].passwordHash).toBe('stored-hash');
    });

    it('changes the password and revokes in one transaction', async () => {
      const token = await issue();

      await service.reset(token, 'Nouveau-Mot2Passe!');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown token', async () => {
      await expect(
        service.reset('never-issued', 'Nouveau-Mot2Passe!'),
      ).rejects.toThrow(new BadRequestException(INVALID_LINK));
    });

    it('rejects a token that has already been used', async () => {
      const token = await issue();
      await service.reset(token, 'Nouveau-Mot2Passe!');

      await expect(service.reset(token, 'Encore-Un-Autre!')).rejects.toThrow(
        new BadRequestException(INVALID_LINK),
      );
    });

    it('rejects an expired token', async () => {
      const token = await issue();
      resetRows[0].expiresAt = new Date(Date.now() - 1);

      await expect(service.reset(token, 'Nouveau-Mot2Passe!')).rejects.toThrow(
        new BadRequestException(INVALID_LINK),
      );
    });

    it('tells the four refusals apart in no way at all', async () => {
      const used = await issue();
      await service.reset(used, 'Nouveau-Mot2Passe!');

      const expired = await issue();
      resetRows[1].expiresAt = new Date(Date.now() - 1);

      users.push(userRow({ id: 2, email: 'off@test.dev' }));
      await service.requestReset('off@test.dev');
      await flush();
      const deactivated = sentToken();
      users[1].isActive = false;

      const messages = await Promise.all(
        ['never-issued', used, expired, deactivated].map((token) =>
          service
            .reset(token, 'Encore-Un-Autre!')
            .then(() => 'accepted')
            .catch((error: Error) => error.message),
        ),
      );

      expect(new Set(messages).size).toBe(1);
      expect(messages[0]).toBe(INVALID_LINK);
    });

    /** Two submissions of the same link racing: the compare-and-swap on
     * `usedAt` must let exactly one through. */
    it('lets only one of two concurrent submissions through', async () => {
      const token = await issue();

      const outcomes = await Promise.allSettled([
        service.reset(token, 'Nouveau-Mot2Passe!'),
        service.reset(token, 'Un-Autre-Encore!'),
      ]);

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1);
    });

    it("invalidates the account's other pending requests", async () => {
      await service.requestReset('candidate@test.dev');
      await flush();
      const second = await issue();

      await service.reset(second, 'Nouveau-Mot2Passe!');

      expect(resetRows.every((row) => row.usedAt !== null)).toBe(true);
    });
  });
});
