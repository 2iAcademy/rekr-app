import type { CreateOfferDto, OfferDetailDto } from '@/api/generated';
import type { ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';
import type { OfferStatus } from '@/domain/offerStatus';
import { optionalEnum, optionalInteger, withoutEmptyFields } from '@/lib/payload';

/**
 * Every value is held as a string (or `''` for an unset enum) because that is
 * what the inputs produce — same convention as `RecruiterOnboardingState`.
 * Coercion to the API shape happens once, in `buildOfferPayload`.
 *
 * `status` is the one field the onboarding wizard does not have: there the
 * first offer is pinned to `open`, here the recruiter drives the whole life
 * cycle from the same form.
 */
export interface OfferFormValue {
  title: string;
  description: string;
  city: string;
  postalCode: string;
  skills: string[];
  benefits: string[];
  contractType: ContractType | '';
  minExperienceLevel: ExperienceLevel | '';
  remotePolicy: RemotePolicy | '';
  salaryMin: string;
  salaryMax: string;
  status: OfferStatus;
}

/** A new offer starts as a draft: publishing is a decision, not a default. */
export const emptyOfferForm: OfferFormValue = {
  title: '',
  description: '',
  city: '',
  postalCode: '',
  skills: [],
  benefits: [],
  contractType: '',
  minExperienceLevel: '',
  remotePolicy: '',
  salaryMin: '',
  salaryMax: '',
  status: 'draft',
};

/**
 * Which of the two writes the body is for. The distinction only matters to the
 * salary range, but it has to be told rather than guessed: an emptied box and
 * an untouched one look identical in the form.
 */
export type OfferWriteIntent = 'create' | 'update';

/**
 * A PATCH only writes the keys it carries, so on an update an emptied salary
 * has to travel as an explicit `null`: omitting it would mean « leave the
 * stored figure alone », and the recruiter would come back to the range they
 * just cleared. On a create there is nothing to erase, and omitting keeps the
 * body to what was actually filled in.
 *
 * The enums opposite stay omitted in both cases — the API declares them
 * nullable nowhere, so `contractType: null` would be a 400 where the salary
 * columns take a NULL.
 */
const salaryToWrite = (value: string, intent: OfferWriteIntent): number | null | undefined => {
  const parsed = optionalInteger(value);

  return parsed === undefined && intent === 'update' ? null : parsed;
};

/**
 * One builder for both writes: `UpdateOfferDto` is a `PartialType` of
 * `CreateOfferDto`, so a complete creation body is also a valid patch — and
 * every field of this form is required except the salary range, which means the
 * two operations never have anything to send apart beyond the clearing above.
 *
 * Unset values are dropped rather than sent empty: the API marks them
 * `@IsOptional()`, which skips `undefined` and `null` — `contractType: ''`
 * would fail `@IsEnum`.
 */
export const buildOfferPayload = (form: OfferFormValue, intent: OfferWriteIntent): CreateOfferDto =>
  withoutEmptyFields({
    title: form.title.trim(),
    description: form.description.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    // Always sent, never `optionalList`: each category is rewritten as a whole
    // server-side, so an omitted list would keep the entries just removed.
    skills: form.skills,
    benefits: form.benefits,
    contractType: optionalEnum(form.contractType),
    minExperienceLevel: optionalEnum(form.minExperienceLevel),
    remotePolicy: optionalEnum(form.remotePolicy),
    salaryMin: salaryToWrite(form.salaryMin, intent),
    salaryMax: salaryToWrite(form.salaryMax, intent),
    status: form.status,
  });

const labelsOfCategory = (offer: OfferDetailDto, category: 'skill' | 'benefit'): string[] =>
  offer.tags.filter((tag) => tag.category === category).map((tag) => tag.label);

/**
 * The detail endpoint is shared with the candidate screen, and it withholds the
 * postcode and the status from anyone but the company carrying the offer. This
 * form needs both, so their absence is not a value to fall back on: it means
 * the API did not recognise the caller as the owner, and filling the gap with a
 * default would silently rewrite where the offer stands on the next save.
 */
const ownerFieldsOf = (offer: OfferDetailDto): { postalCode: string; status: OfferStatus } => {
  if (offer.status === undefined) {
    throw new Error("L'offre a été servie sans ses champs de gestion.");
  }

  return { postalCode: offer.postalCode ?? '', status: offer.status };
};

/**
 * Both lists arrive as tags on the same offer, told apart by their category.
 * Anything in a third category is left out — it is not the recruiter's to edit
 * here.
 */
export const offerFormFromDetail = (offer: OfferDetailDto): OfferFormValue => ({
  title: offer.title,
  description: offer.description ?? '',
  city: offer.city ?? '',
  skills: labelsOfCategory(offer, 'skill'),
  benefits: labelsOfCategory(offer, 'benefit'),
  contractType: offer.contractType ?? '',
  minExperienceLevel: offer.minExperienceLevel ?? '',
  remotePolicy: offer.remotePolicy ?? '',
  salaryMin: offer.salaryMin === null ? '' : String(offer.salaryMin),
  salaryMax: offer.salaryMax === null ? '' : String(offer.salaryMax),
  ...ownerFieldsOf(offer),
});
