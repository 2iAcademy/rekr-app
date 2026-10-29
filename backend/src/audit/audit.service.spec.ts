import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const create = jest.fn();
  const deleteMany = jest.fn();
  const service = new AuditService({
    auditEvent: { create, deleteMany },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes the event with a truncated address', async () => {
    create.mockResolvedValue({});

    await service.record({
      action: 'account_deleted',
      actorId: 7,
      target: { type: 'user', id: 7 },
      ip: '203.0.113.42',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        action: 'account_deleted',
        actorId: 7,
        targetType: 'user',
        targetId: 7,
        ip: '203.0.113.0',
        detail: undefined,
      },
    });
  });

  it('writes an event with no actor, target or address', async () => {
    create.mockResolvedValue({});

    await service.record({ action: 'login_failed' });

    expect(create).toHaveBeenCalledWith({
      data: {
        action: 'login_failed',
        actorId: null,
        targetType: null,
        targetId: null,
        ip: null,
        detail: undefined,
      },
    });
  });

  it('logs a failed write instead of throwing it', async () => {
    create.mockRejectedValue(new Error('connection lost'));
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.record({ action: 'login_succeeded', actorId: 1 }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'Audit event login_succeeded could not be written.',
      expect.any(String),
    );
  });

  it('purges the events older than twelve months', async () => {
    deleteMany.mockResolvedValue({ count: 3 });

    await expect(
      service.purgeExpired(new Date('2026-10-29T12:00:00Z')),
    ).resolves.toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { occurredAt: { lt: new Date('2025-10-29T12:00:00Z') } },
    });
  });
});
