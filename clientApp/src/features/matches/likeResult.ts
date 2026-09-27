import type { LikeResultDto } from '@/api/generated';

/** The role-safe match payload returned by either reciprocal-like endpoint. */
export type LikeResult = LikeResultDto;

export const matchedCounterpart = (result: LikeResult) =>
  result.matchCreated ? (result.match?.counterpart ?? null) : null;

export const matchedCompany = (result: LikeResult) => {
  const counterpart = matchedCounterpart(result);
  return counterpart?.kind === 'company' ? counterpart : null;
};

export const matchedCandidate = (result: LikeResult) => {
  const counterpart = matchedCounterpart(result);
  return counterpart?.kind === 'candidate' ? counterpart : null;
};
