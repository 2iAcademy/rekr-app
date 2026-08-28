import type { CompanyResponseDto } from '@/api/generated';
import type { CompanySize } from '@/domain/enums';
import { withoutEmptyFields } from '@/lib/payload';

/**
 * Every value is held as a string, because that is what the inputs produce.
 * Coercion to the API shape happens once, in `buildAccountPayload`.
 */
export interface RecruiterAccountForm {
  firstName: string;
  lastName: string;
  jobTitle: string;
  name: string;
  sectorId: string;
  size: CompanySize | '';
  city: string;
  postalCode: string;
  siteUrl: string;
  description: string;
}

export const emptyRecruiterAccountForm: RecruiterAccountForm = {
  firstName: '',
  lastName: '',
  jobTitle: '',
  name: '',
  sectorId: '',
  size: '',
  city: '',
  postalCode: '',
  siteUrl: '',
  description: '',
};

export type RecruiterAccountField = 'firstName' | 'lastName' | 'name' | 'city';

/**
 * Declared as a type alias, not an interface: `UpdateCompanyDto` is generated as
 * `{ [key: string]: unknown }`, and only an object type alias gets the implicit
 * index signature that makes it assignable to one.
 */
export type RecruiterAccountPayload = {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  name: string;
  sectorId: number | null;
  size?: CompanySize;
  siteUrl: string;
  description: string | null;
  city?: string;
  postalCode?: string;
};

export const formFromCompany = (company: CompanyResponseDto): RecruiterAccountForm => ({
  firstName: company.recruiter.firstName,
  lastName: company.recruiter.lastName,
  jobTitle: company.recruiter.jobTitle ?? '',
  name: company.name,
  sectorId: company.sectorId === null ? '' : String(company.sectorId),
  size: company.size ?? '',
  city: company.city ?? '',
  postalCode: company.postalCode ?? '',
  siteUrl: company.siteUrl ?? '',
  description: company.description ?? '',
});

/**
 * An edit form does not have the same emptiness rules as the onboarding wizard,
 * so this is not `buildCompanyPayload`: there, an untouched field is absent from
 * the body; here, a field the user emptied has to be sent as such, or the stored
 * value would silently survive.
 *
 * `null` is what expresses that: `@IsOptional()` skips validation on `null` as
 * well as on `undefined`, and every column below is nullable. The exception is
 * `siteUrl`, whose `@IsUrl` would refuse anything but a URL — the API maps an
 * empty string to `null` for exactly this reason.
 *
 * `latitude` / `longitude` are absent on purpose: they are derived server-side
 * from the city pair, and `forbidNonWhitelisted` answers 400 on them. So are
 * `logo` and `coverImage`, which only their own endpoints write.
 */
export const buildAccountPayload = (form: RecruiterAccountForm): RecruiterAccountPayload => {
  const city = form.city.trim();
  const postalCode = form.postalCode.trim();
  const sectorId = Number.parseInt(form.sectorId, 10);

  return withoutEmptyFields({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    jobTitle: form.jobTitle.trim() || null,
    name: form.name.trim(),
    sectorId: Number.isNaN(sectorId) ? null : sectorId,
    size: form.size || undefined,
    // Sent whatever its state: the API turns an empty string into `null`, which
    // is the only way to take a site back off the company.
    siteUrl: form.siteUrl.trim(),
    description: form.description.trim() || null,
    // A location is a pair or nothing — the API refuses a lone city.
    city: city && postalCode ? city : undefined,
    postalCode: city && postalCode ? postalCode : undefined,
  });
};

const REQUIRED_MESSAGES: Readonly<Record<'firstName' | 'lastName' | 'name', string>> = {
  firstName: 'Renseignez votre prénom.',
  lastName: 'Renseignez votre nom.',
  name: 'Renseignez le nom de la société.',
};

interface InvalidField {
  field: RecruiterAccountField;
  message: string;
}

/**
 * A commune is mandatory even though the column is nullable: typing in the city
 * field clears the selected one, so without this a company loses its address by
 * accident — and the API keeps the coordinates of the old commune when the pair
 * arrives empty, leaving the row half erased. Half a pair is refused too: the
 * API derives the coordinates from both and answers 400 on a lone city.
 */
export const firstInvalidField = (form: RecruiterAccountForm): InvalidField | null => {
  for (const field of ['firstName', 'lastName', 'name'] as const) {
    if (form[field].trim() === '') {
      return { field, message: REQUIRED_MESSAGES[field] };
    }
  }

  if (form.city.trim() === '' || form.postalCode.trim() === '') {
    return {
      field: 'city',
      message: 'Choisissez votre commune dans la liste.',
    };
  }

  return null;
};

/**
 * Reads the storage key back from a file write.
 *
 * The endpoint answers with the updated `company` row, but the generated client
 * types its body `void`: those handlers carry no `@ApiOkResponse`, so the
 * OpenAPI document declares no schema for them. Reading the column defensively
 * keeps that single cast here — and each replacement mints a fresh key, so
 * adopting it is what keeps the preview from pointing at a deleted file.
 */
export const readFileKey = (data: unknown, column: 'logo' | 'coverImage'): string | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const value = (data as Record<string, unknown>)[column];

  return typeof value === 'string' ? value : null;
};
