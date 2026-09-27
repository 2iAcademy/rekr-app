import { describe, expect, it } from 'vitest';

import {
  matchedCandidate,
  matchedCompany,
  matchedCounterpart,
  type LikeResult,
} from './likeResult';

const companyMatch: LikeResult = {
  likeCreated: true,
  matchCreated: true,
  match: {
    id: 1,
    matchedAt: '2026-09-17T11:30:00.000Z',
    offer: { id: 10, title: 'Développeur back-end' },
    counterpart: {
      kind: 'company',
      id: 20,
      name: 'Acme',
      avatarUrl: null,
      headline: null,
    },
  },
};

const candidateMatch: LikeResult = {
  likeCreated: true,
  matchCreated: true,
  match: {
    id: 2,
    matchedAt: '2026-09-17T11:30:00.000Z',
    offer: { id: 10, title: 'Développeur back-end' },
    counterpart: {
      kind: 'candidate',
      id: 30,
      name: 'Camille Martin',
      avatarUrl: '/candidate.png',
      headline: 'Développeuse full-stack',
    },
  },
};

describe('likeResult', () => {
  it('returns no counterpart when a like does not create a match', () => {
    const result: LikeResult = { likeCreated: true, matchCreated: false };

    expect(matchedCounterpart(result)).toBeNull();
    expect(matchedCompany(result)).toBeNull();
    expect(matchedCandidate(result)).toBeNull();
  });

  it('returns no counterpart when the API omits the created-match payload', () => {
    const result: LikeResult = { likeCreated: true, matchCreated: true };

    expect(matchedCounterpart(result)).toBeNull();
    expect(matchedCompany(result)).toBeNull();
    expect(matchedCandidate(result)).toBeNull();
  });

  it('returns a company counterpart only for the company helper', () => {
    expect(matchedCounterpart(companyMatch)).toEqual(companyMatch.match?.counterpart);
    expect(matchedCompany(companyMatch)).toEqual(companyMatch.match?.counterpart);
    expect(matchedCandidate(companyMatch)).toBeNull();
  });

  it('returns a candidate counterpart only for the candidate helper', () => {
    expect(matchedCounterpart(candidateMatch)).toEqual(candidateMatch.match?.counterpart);
    expect(matchedCandidate(candidateMatch)).toEqual(candidateMatch.match?.counterpart);
    expect(matchedCompany(candidateMatch)).toBeNull();
  });
});
