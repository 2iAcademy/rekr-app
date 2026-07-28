import { SetMetadata } from '@nestjs/common';

export const THROTTLE_SCOPE_KEY = 'throttle:scope';

export type ThrottleScopeName = 'login' | 'signup' | 'logs';

export const ThrottleScope = (scope: ThrottleScopeName) =>
  SetMetadata(THROTTLE_SCOPE_KEY, scope);
