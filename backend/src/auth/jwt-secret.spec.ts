import { ConfigService } from '@nestjs/config';
import { DEV_JWT_SECRET_PREFIX, resolveJwtSecret } from './jwt-secret';

const configOf = (values: Record<string, string>): ConfigService =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

const DEV_SECRET = `${DEV_JWT_SECRET_PREFIX}insecure-jwt-secret-for-local-compose`;
const STRONG_SECRET = 'k3J9xQ2mV7pL4sT8wZ1bN6cR5yH0aF3d';

describe('resolveJwtSecret', () => {
  it('refuses to start without a secret', () => {
    expect(() => resolveJwtSecret(configOf({}))).toThrow(/JWT_SECRET/);
  });

  it('refuses a blank secret', () => {
    expect(() => resolveJwtSecret(configOf({ JWT_SECRET: '   ' }))).toThrow(
      /JWT_SECRET/,
    );
  });

  it('accepts the development secret outside production', () => {
    expect(resolveJwtSecret(configOf({ JWT_SECRET: DEV_SECRET }))).toBe(
      DEV_SECRET,
    );
  });

  it('refuses the development secret in production', () => {
    expect(() =>
      resolveJwtSecret(
        configOf({ JWT_SECRET: DEV_SECRET, NODE_ENV: 'production' }),
      ),
    ).toThrow(/development value/);
  });

  it('refuses a short secret in production', () => {
    expect(() =>
      resolveJwtSecret(
        configOf({ JWT_SECRET: 'too-short', NODE_ENV: 'production' }),
      ),
    ).toThrow(/at least 32/);
  });

  it('accepts a strong secret in production', () => {
    expect(
      resolveJwtSecret(
        configOf({ JWT_SECRET: STRONG_SECRET, NODE_ENV: 'production' }),
      ),
    ).toBe(STRONG_SECRET);
  });
});
