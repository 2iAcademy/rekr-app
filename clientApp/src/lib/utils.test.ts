import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeSince } from './utils';

describe('timeSince', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['à l’instant', '2026-08-23T12:00:00.000Z', "à l'instant"],
    ['une durée future', '2026-08-23T12:05:00.000Z', "à l'instant"],
    ['des minutes', '2026-08-23T11:42:00.000Z', 'il y a 18 min'],
    ['des heures', '2026-08-23T09:00:00.000Z', 'il y a 3 h'],
    ['des jours', '2026-08-20T12:00:00.000Z', 'il y a 3 j'],
    ['des semaines', '2026-08-09T12:00:00.000Z', 'il y a 2 sem.'],
  ])('formate %s', (_description, date, expected) => {
    expect(timeSince(date)).toBe(expected);
  });
});
