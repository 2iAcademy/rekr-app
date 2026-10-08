import { ConfigService } from '@nestjs/config';

/**
 * Prefix of the throwaway secret `compose.yml` hands to the development stack.
 * The value is public, so production refuses anything that carries it.
 */
export const DEV_JWT_SECRET_PREFIX = 'dev-only-';

const MIN_PRODUCTION_LENGTH = 32;

export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required to start the API.');
  }

  if (config.get<string>('NODE_ENV')?.trim() === 'production') {
    if (secret.startsWith(DEV_JWT_SECRET_PREFIX)) {
      throw new Error(
        'JWT_SECRET still holds the development value: production needs its own secret.',
      );
    }
    if (secret.length < MIN_PRODUCTION_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_LENGTH} characters in production.`,
      );
    }
  }

  return secret;
}
