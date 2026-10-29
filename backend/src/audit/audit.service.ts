import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { AUDIT_EVENT_RETENTION_MONTHS } from '../account/privacy-policy';
import { PrismaService } from '../prisma/prisma.service';
import { truncateIp } from './truncate-ip';

export interface AuditEntry {
  action: AuditAction;
  actorId?: number | null;
  target?: { type: 'user' | 'offer'; id: number };
  ip?: string;
  detail?: Prisma.InputJsonObject;
}

/**
 * Writes the security journal. Never throws: a journal that could not be
 * written must not turn a login or a deletion into a 500, so a failure is
 * logged — and reaches Sentry through the logger — instead of propagated.
 *
 * Nothing that names a person goes in: no e-mail, no password, no full IP.
 * A failed login on an address no account uses is recorded without an actor,
 * which is all the journal needs to show a credential-stuffing burst.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          targetType: entry.target?.type ?? null,
          targetId: entry.target?.id ?? null,
          ip: truncateIp(entry.ip),
          detail: entry.detail,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Audit event ${entry.action} could not be written.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Deletes the events older than the retention period and answers how many. */
  async purgeExpired(now: Date): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - AUDIT_EVENT_RETENTION_MONTHS);

    const { count } = await this.prisma.auditEvent.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    });

    return count;
  }
}
