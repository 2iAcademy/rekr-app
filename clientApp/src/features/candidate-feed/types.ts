import type { ContractType, RemotePolicy } from '@/domain/enums';

export interface FeedOffer {
  id: number;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  companySize: string | null;
  city: string | null;
  contractType: ContractType;
  remotePolicy: RemotePolicy;
  stack: readonly string[];
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
}

export interface OfferFeedFilters {
  readonly contractTypes: readonly ContractType[];
  readonly remotePolicies: readonly RemotePolicy[];
}

export const emptyOfferFeedFilters: OfferFeedFilters = Object.freeze({
  contractTypes: Object.freeze([]),
  remotePolicies: Object.freeze([]),
});
