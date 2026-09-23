import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';
import { INACTIVE_ACCOUNT_RETENTION_MONTHS } from './privacy-policy';

const DEFAULT_INTERVAL_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

/** Bounded so a first run on a large backlog cannot hold the process for long;
 * the next run takes the rest. */
const BATCH_SIZE = 200;

/**
 * Applies the retention period the privacy policy announces: an account with no
 * sign-in, login or refresh for `INACTIVE_ACCOUNT_RETENTION_MONTHS` is erased
 * exactly as if its owner had asked.
 *
 * A timer rather than `@nestjs/schedule`: one daily job does not justify a
 * dependency. It runs once at boot, then every `ACCOUNT_PURGE_INTERVAL_HOURS`
 * (0 disables it — the e2e suite does, so no test races a purge). Two replicas
 * running it at once only compete for the same rows; the loser's delete fails
 * on a row already gone and is logged.
 */
@Injectable()
export class AccountRetentionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AccountRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const hours = this.intervalHours();
    if (hours === 0) {
      return;
    }

    const run = () => void this.purgeInactive(new Date()).catch(this.report);
    run();
    this.timer = setInterval(run, hours * HOUR_MS);
    // A pending purge must never be what keeps the process alive.
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Erases the accounts idle past the retention period and answers how many.
   * Activity is `last_active_at`, or the creation date for an account that has
   * none recorded. Admin accounts are staff, not users of the service, and are
   * left alone.
   */
  async purgeInactive(now: Date): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(
      cutoff.getUTCMonth() - INACTIVE_ACCOUNT_RETENTION_MONTHS,
    );

    const stale = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "user"
      WHERE user_type <> 'admin'
        AND COALESCE(last_active_at, created_at) < ${cutoff}
      ORDER BY id
      LIMIT ${BATCH_SIZE}`;

    let erased = 0;
    for (const { id } of stale) {
      try {
        await this.accounts.erase(id);
        erased += 1;
      } catch (error) {
        this.report(error);
      }
    }

    if (erased > 0) {
      this.logger.log(`Retention purge erased ${erased} inactive account(s).`);
    }

    return erased;
  }

  private intervalHours(): number {
    const raw = this.config.get<string>('ACCOUNT_PURGE_INTERVAL_HOURS')?.trim();
    if (!raw) {
      return DEFAULT_INTERVAL_HOURS;
    }

    const hours = Number(raw);
    if (!Number.isInteger(hours) || hours < 0) {
      throw new Error(
        `ACCOUNT_PURGE_INTERVAL_HOURS must be a non-negative integer, received "${raw}".`,
      );
    }

    return hours;
  }

  private readonly report = (error: unknown): void => {
    this.logger.error(
      'Retention purge failed.',
      error instanceof Error ? error.stack : undefined,
    );
  };
}
