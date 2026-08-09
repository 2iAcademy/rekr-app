import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import {
  THROTTLE_SCOPE_KEY,
  ThrottleScopeName,
} from './throttle-scope.decorator';

type ThrottleBudgetName = 'default' | ThrottleScopeName;

const DEFAULT_TTL_SECONDS = 60;

/**
 * Budgets are counted per route handler and per client IP: ThrottlerGuard keys
 * its storage on `<controller>-<handler>-<throttler>-<ip>`. A single throttler
 * whose limit is resolved from the route metadata is therefore enough — the
 * `default` budget never mixes with the credential or log-ingestion ones.
 *
 * `default` stays wide enough for ordinary navigation. `login` is the tightest:
 * a human mistypes a password a few times, a script tries hundreds. `signup`
 * and `logs` are looser because legitimate bursts exist there (a shared office
 * IP onboarding a team, a client flushing a queue of buffered errors), but they
 * still cap the enumeration and flooding loops that M2 and M4 rely on.
 */
const DEFAULT_LIMITS: Record<ThrottleBudgetName, number> = {
  default: 100,
  login: 5,
  signup: 10,
  logs: 20,
  refresh: 30,
  // One autocompletion field sends a request per debounced keystroke, and a
  // shared office IP multiplies that by the number of people onboarding at
  // once. The answers are cached server-side, so the cost of a burst is low.
  cities: 200,
};

export function buildThrottlerOptions(
  configService: ConfigService,
): ThrottlerModuleOptions {
  const reflector = new Reflector();
  const ttlSeconds = readPositiveInt(
    configService,
    'THROTTLE_TTL_SECONDS',
    DEFAULT_TTL_SECONDS,
  );
  const limits = readLimits(configService);

  return {
    throttlers: [
      {
        name: 'default',
        ttl: ttlSeconds * 1000,
        limit: (context: ExecutionContext) =>
          limits[budgetOf(reflector, context)],
      },
    ],
  };
}

function readLimits(
  configService: ConfigService,
): Record<ThrottleBudgetName, number> {
  return {
    default: readPositiveInt(
      configService,
      'THROTTLE_DEFAULT_LIMIT',
      DEFAULT_LIMITS.default,
    ),
    login: readPositiveInt(
      configService,
      'THROTTLE_LOGIN_LIMIT',
      DEFAULT_LIMITS.login,
    ),
    signup: readPositiveInt(
      configService,
      'THROTTLE_SIGNUP_LIMIT',
      DEFAULT_LIMITS.signup,
    ),
    logs: readPositiveInt(
      configService,
      'THROTTLE_LOGS_LIMIT',
      DEFAULT_LIMITS.logs,
    ),
    refresh: readPositiveInt(
      configService,
      'THROTTLE_REFRESH_LIMIT',
      DEFAULT_LIMITS.refresh,
    ),
    cities: readPositiveInt(
      configService,
      'THROTTLE_CITIES_LIMIT',
      DEFAULT_LIMITS.cities,
    ),
  };
}

function budgetOf(
  reflector: Reflector,
  context: ExecutionContext,
): ThrottleBudgetName {
  return (
    reflector.getAllAndOverride<ThrottleScopeName | undefined>(
      THROTTLE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? 'default'
  );
}

function readPositiveInt(
  configService: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = configService.get<string>(key);
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer, received "${raw}".`);
  }

  return parsed;
}
