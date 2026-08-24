import type { ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';
import {
  CONTRACT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from '@/domain/options';
import type { EmptyReason } from './deck';
import type { FeedCandidate } from './types';

// Read from the shared option lists so a wording fixed for the forms is fixed
// here too, instead of drifting into a second vocabulary on the feed.
const labelOf = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string => options.find((option) => option.value === value)?.label ?? value;

export const experienceLabel = (level: ExperienceLevel): string =>
  labelOf(EXPERIENCE_LEVEL_OPTIONS, level);

export const contractLabel = (type: ContractType): string => labelOf(CONTRACT_TYPE_OPTIONS, type);

export const remoteLabel = (policy: RemotePolicy): string => labelOf(REMOTE_POLICY_OPTIONS, policy);

export const nameWithAge = ({ firstName, lastName, age }: FeedCandidate): string =>
  [`${firstName} ${lastName}`.trim(), age === null ? null : `${age} ans`]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formatted from the ISO parts, not through `toLocaleDateString`: a UTC
 * midnight rendered in a negative offset would announce the day before.
 */
const frenchDate = (value: string | null): string | null => {
  const parts = value?.match(ISO_DATE);

  if (!parts || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    return null;
  }

  const [, year, month, day] = parts;

  return `${day}/${month}/${year}`;
};

export const availabilityLabel = ({
  availability,
  availabilityDelayMonths,
  availabilityDate,
}: FeedCandidate): string => {
  if (availability === 'IMMEDIATE') {
    return 'Dispo immédiate';
  }

  if (availability === 'WITHIN_DELAY') {
    return availabilityDelayMonths === null
      ? 'Dispo sous quelques mois'
      : `Dispo sous ${availabilityDelayMonths} mois`;
  }

  const date = frenchDate(availabilityDate);

  return date === null ? 'Dispo à préciser' : `Dispo le ${date}`;
};

/**
 * Returns null when mobility is unknown, so the caller drops the line instead
 * of asserting a limit the candidate never gave.
 *
 * A radius of zero or less is read as unknown too: it can only come from an
 * untouched or broken field, and "rayon de 0 km" would tell a recruiter the
 * candidate refuses to move.
 */
export const mobilityLabel = ({
  mobilityNationwide,
  mobilityRadiusKm,
}: FeedCandidate): string | null => {
  if (mobilityNationwide === true) {
    return 'Mobile dans toute la France';
  }

  if (mobilityRadiusKm === null || mobilityRadiusKm <= 0) {
    return null;
  }

  return `Mobile dans un rayon de ${mobilityRadiusKm} km`;
};

const thousands = (amount: number): number => Math.round(amount / 1000);

// Returns null when neither bound is known, so the caller words that case
// itself instead of stitching "Souhaite" onto a "not disclosed".
const salaryLabel = (min: number | null, max: number | null): string | null => {
  if (min !== null && max !== null) {
    return `${thousands(min)} - ${thousands(max)} k€`;
  }

  if (min !== null) {
    return `À partir de ${thousands(min)} k€`;
  }

  if (max !== null) {
    return `Jusqu'à ${thousands(max)} k€`;
  }

  return null;
};

export const salaryWishLabel = (min: number | null, max: number | null): string => {
  const amount = salaryLabel(min, max);

  if (amount === null) {
    return 'Prétention non communiquée';
  }

  return `Souhaite ${amount.charAt(0).toLowerCase()}${amount.slice(1)}`;
};

export const metaLine = (parts: readonly (string | null | undefined)[]): string =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ');

// Zero is a state, not a quantity: "0 profil liké" reads like a scoreboard.
export const likedCountLabel = (count: number): string => {
  if (count === 0) {
    return 'Aucun profil liké';
  }

  return count === 1 ? '1 profil liké' : `${count} profils likés`;
};

// Shared with the deck's live region, so the announcement says the very words
// the empty state puts on screen.
export const emptyDeckTitle = (reason: EmptyReason): string =>
  reason === 'no-match' ? 'Aucun profil ne passe vos filtres' : 'Vous avez vu tous les profils';
