import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

const TIMEOUT_MS = 3000;

/**
 * Terminus' own Prisma indicator copies the driver error into the 503 body,
 * and that message can name the database host or user. The route is public,
 * so the reason goes to the log and the response only says `down`.
 */
@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy<const Key extends string>(key: Key) {
    const indicator = this.healthIndicatorService.check(key);
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`no answer within ${TIMEOUT_MS} ms`)),
            TIMEOUT_MS,
          );
        }),
      ]);
      return indicator.up();
    } catch (cause) {
      this.logger.warn(`PostgreSQL health check failed. ${reasonOf(cause)}`);
      return indicator.down();
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Driver adapter errors can carry an empty message and only a name or code. */
function reasonOf(cause: unknown): string {
  if (!(cause instanceof Error)) return String(cause);
  const code = (cause as { code?: unknown }).code;
  return [cause.name, typeof code === 'string' ? code : '', cause.message]
    .filter(Boolean)
    .join(' ');
}
