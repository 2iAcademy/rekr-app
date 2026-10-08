import type { LikeResultDto } from '@/api/generated';

/** The role-safe match payload returned by either reciprocal-like endpoint. */
export type LikeResult = LikeResultDto;

/** What the « It's a match » screen shows, and the conversation it opens. */
export interface MatchedProfile {
  matchId: number;
  name: string;
  avatarUrl: string | null;
}

export const matchedCounterpart = (result: LikeResult) =>
  result.matchCreated ? (result.match?.counterpart ?? null) : null;

const matchedProfile = (
  result: LikeResult,
  kind: 'company' | 'candidate',
): MatchedProfile | null => {
  const counterpart = matchedCounterpart(result);
  if (!result.match || counterpart?.kind !== kind) return null;
  return { matchId: result.match.id, name: counterpart.name, avatarUrl: counterpart.avatarUrl };
};

export const matchedCompany = (result: LikeResult) => matchedProfile(result, 'company');

export const matchedCandidate = (result: LikeResult) => matchedProfile(result, 'candidate');
