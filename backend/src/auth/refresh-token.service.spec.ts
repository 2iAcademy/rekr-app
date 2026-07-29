import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';
import { seal, unseal } from './successor-seal';

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';

const refreshTokenRow = (
  overrides: Partial<RefreshToken> = {},
): RefreshToken => ({
  id: 7,
  userId: 1,
  tokenHash: 'a'.repeat(64),
  familyId: FAMILY_ID,
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  successorSealed: null,
  userAgent: null,
  ip: null,
  createdAt: new Date(),
  ...overrides,
});

type CreatedRow = {
  userId: number;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
};

type UpdateManyCall = {
  where: { id: number; revokedAt: null };
  data: { revokedAt: Date; successorSealed: string };
};

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  /** Rows the fake database serves back, keyed the two ways the service looks
   * them up: by hash when following a sealed successor, by id when re-reading
   * the row it just lost a race on. */
  const byHash = new Map<string, RefreshToken>();
  const byId = new Map<number, RefreshToken>();

  const store = (row: RefreshToken): RefreshToken => {
    byHash.set(row.tokenHash, row);
    byId.set(row.id, row);

    return row;
  };

  /** A row addressable by its plaintext, the way a real one is. */
  const rowFor = (
    token: string,
    overrides: Partial<RefreshToken> = {},
  ): RefreshToken =>
    store(
      refreshTokenRow({
        tokenHash: RefreshTokenService.hash(token),
        ...overrides,
      }),
    );

  beforeEach(async () => {
    byHash.clear();
    byId.clear();

    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(
          ({ where }: { where: { tokenHash?: string; id?: number } }) =>
            Promise.resolve(
              where.tokenHash !== undefined
                ? (byHash.get(where.tokenHash) ?? null)
                : (byId.get(where.id as number) ?? null),
            ),
        ),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((run: (tx: unknown) => unknown) => run(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();

    service = moduleRef.get(RefreshTokenService);
  });

  const lastCreatedRow = (): CreatedRow =>
    (prisma.refreshToken.create.mock.calls[0] as [{ data: CreatedRow }])[0]
      .data;

  const lastClaim = (): UpdateManyCall =>
    (prisma.refreshToken.updateMany.mock.calls[0] as [UpdateManyCall])[0];

  it('stores the SHA-256 of the token, never the token itself', async () => {
    const issued = await service.issue(1, {});

    const stored = lastCreatedRow();
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(issued.token, 'utf8').digest('hex'),
    );
    expect(JSON.stringify(stored)).not.toContain(issued.token);
  });

  it('issues 32 bytes of entropy, base64url encoded', async () => {
    const issued = await service.issue(1, {});

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
  });

  it('never issues the same token twice', async () => {
    const first = await service.issue(1, {});
    const second = await service.issue(1, {});

    expect(first.token).not.toBe(second.token);
  });

  it('opens a new family on each issue', async () => {
    const first = await service.issue(1, {});
    const second = await service.issue(1, {});

    expect(first.familyId).not.toBe(second.familyId);
    expect(first.familyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('expires 30 days out by default', async () => {
    const before = Date.now();
    const issued = await service.issue(1, {});

    const days = (issued.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it('truncates an oversized user agent to the column width', async () => {
    await service.issue(1, { userAgent: 'x'.repeat(400) });

    expect(lastCreatedRow().userAgent).toHaveLength(255);
  });

  describe('findByToken', () => {
    it('looks the row up by hash, never by the plaintext', async () => {
      await service.findByToken('some-raw-token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: RefreshTokenService.hash('some-raw-token') },
      });
    });
  });

  describe('rotate', () => {
    /**
     * The guard is the whole mechanism: without `revokedAt: null` in the
     * WHERE, two concurrent rotations both succeed and the family forks into
     * two live branches that nothing ever reconciles.
     */
    it('claims the row with a guarded update rather than a blind one', async () => {
      const current = rowFor('current');

      await service.rotate(current, 'current', {});

      expect(lastClaim().where).toEqual({ id: current.id, revokedAt: null });
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    /** Sealed under the presented token, which the database never holds: a
     * dump exposes the blob and the predecessor's hash, and neither opens the
     * other. */
    it('seals the successor onto the row it revokes', async () => {
      const issued = await service.rotate(rowFor('current'), 'current', {});

      const { successorSealed } = lastClaim().data;
      expect(successorSealed).not.toContain(issued?.token);
      expect(unseal(successorSealed, 'current')).toBe(issued?.token);
      expect(unseal(successorSealed, 'another-token')).toBeNull();
    });

    it('mints the successor in the same family', async () => {
      const issued = await service.rotate(rowFor('current'), 'current', {});

      expect(issued?.familyId).toBe(FAMILY_ID);
      expect(lastCreatedRow().familyId).toBe(FAMILY_ID);
    });

    /** Sliding, not inherited: a session stays alive as long as it is used, so
     * the successor restarts the full TTL rather than the remainder. */
    it('slides the expiry forward instead of inheriting it', async () => {
      const before = Date.now();

      const issued = await service.rotate(
        rowFor('current', { expiresAt: new Date(Date.now() + 60_000) }),
        'current',
        {},
      );

      const days = (issued!.expiresAt.getTime() - before) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);
    });

    /**
     * The point of the whole design: the loser of a strictly concurrent
     * rotation gets the winner's token back rather than a branch of its own.
     * Both callers end up on the same successor, so the family keeps exactly
     * one live token.
     */
    it("hands the winner's successor to the loser of the race", async () => {
      const winnerToken = 'the-successor';
      rowFor(winnerToken, { id: 8 });
      const current = rowFor('current', {
        revokedAt: new Date(),
        successorSealed: seal(winnerToken, 'current'),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const issued = await service.rotate(current, 'current', {});

      expect(issued?.token).toBe(winnerToken);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('reports reuse when the row it lost to was revoked without succession', async () => {
      const current = rowFor('current', { revokedAt: new Date() });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.rotate(current, 'current', {})).resolves.toBeNull();
    });
  });

  describe('replaySuccessor', () => {
    it('replays the successor of a row revoked inside the window', async () => {
      const successor = 'the-successor';
      const successorRow = rowFor(successor, { id: 8 });
      const current = rowFor('current', {
        revokedAt: new Date(),
        successorSealed: seal(successor, 'current'),
      });

      const replayed = await service.replaySuccessor(current, 'current');

      expect(replayed?.token).toBe(successor);
      expect(replayed?.familyId).toBe(FAMILY_ID);
      expect(replayed?.expiresAt).toBe(successorRow.expiresAt);
    });

    /**
     * A logout and a family kill revoke without minting anything, so the empty
     * column is the direct evidence that this revocation was a death and not a
     * handover. That is what closes the hole where a surplus branch made a
     * signed-out token look replayable.
     */
    it('refuses a row revoked without a successor', async () => {
      const current = rowFor('current', { revokedAt: new Date() });

      await expect(
        service.replaySuccessor(current, 'current'),
      ).resolves.toBeNull();
    });

    it('refuses a row revoked beyond the replay window', async () => {
      const successor = 'the-successor';
      rowFor(successor, { id: 8 });
      const current = rowFor('current', {
        revokedAt: new Date(Date.now() - 60_000),
        successorSealed: seal(successor, 'current'),
      });

      await expect(
        service.replaySuccessor(current, 'current'),
      ).resolves.toBeNull();
    });

    /** The window is inclusive. The clock is frozen because the assertion is on
     * the boundary itself — a real one would drift past it between arrange and
     * act. */
    it('still replays on the exact boundary of the window', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-28T12:00:00Z'));
      rowFor('the-successor', { id: 8 });
      const current = rowFor('current', {
        revokedAt: new Date(Date.now() - 10_000),
        successorSealed: seal('the-successor', 'current'),
      });

      const replayed = await service.replaySuccessor(current, 'current');

      expect(replayed?.token).toBe('the-successor');

      jest.useRealTimers();
    });

    it('refuses a blob it cannot open', async () => {
      const current = rowFor('current', {
        revokedAt: new Date(),
        successorSealed: seal('the-successor', 'a-different-predecessor'),
      });

      await expect(
        service.replaySuccessor(current, 'current'),
      ).resolves.toBeNull();
    });

    /**
     * Handing back a successor that has itself been rotated would strand the
     * caller: it only presents that cookie at the next 401, a quarter of an
     * hour later and long outside the window, where it reads as theft and
     * kills the session. So the chain is walked to the live end.
     */
    it('follows the chain when the successor has itself been rotated', async () => {
      const last = rowFor('third', { id: 9 });
      rowFor('second', {
        id: 8,
        revokedAt: new Date(),
        successorSealed: seal('third', 'second'),
      });
      const current = rowFor('first', {
        revokedAt: new Date(),
        successorSealed: seal('second', 'first'),
      });

      const replayed = await service.replaySuccessor(current, 'first');

      expect(replayed?.token).toBe('third');
      expect(replayed?.expiresAt).toBe(last.expiresAt);
    });

    it('stops at a link that was killed rather than handed over', async () => {
      rowFor('second', { id: 8, revokedAt: new Date() });
      const current = rowFor('first', {
        revokedAt: new Date(),
        successorSealed: seal('second', 'first'),
      });

      await expect(
        service.replaySuccessor(current, 'first'),
      ).resolves.toBeNull();
    });

    /** A replay serves the successor as it stands; it must not restart the TTL,
     * or replaying on a loop would keep a session alive forever. */
    it('does not slide the expiry on a replay', async () => {
      const successorExpiry = new Date(Date.now() + 60_000);
      rowFor('the-successor', { id: 8, expiresAt: successorExpiry });
      const current = rowFor('current', {
        revokedAt: new Date(),
        successorSealed: seal('the-successor', 'current'),
      });

      const replayed = await service.replaySuccessor(current, 'current');

      expect(replayed?.expiresAt).toBe(successorExpiry);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('revokeFamily', () => {
    it('revokes every live row of the family in one statement', async () => {
      await service.revokeFamily(FAMILY_ID);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          familyId: FAMILY_ID,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    /** No successor is recorded, which is precisely what stops a replay from
     * walking past a killed session. */
    it('records no succession', async () => {
      await service.revokeFamily(FAMILY_ID);

      expect(lastClaim().data).not.toHaveProperty('successorSealed');
    });
  });

  describe('revokeById', () => {
    it('revokes a single session', async () => {
      await service.revokeById(7);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });
});
