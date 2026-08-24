import type { ContractType, RemotePolicy } from '@/domain/enums';
import { CONTRACT_TYPE_OPTIONS, REMOTE_POLICY_OPTIONS } from '@/domain/options';
import { activeOfferFilterCount } from '../filters';
import { emptyOfferFeedFilters, type OfferFeedFilters } from '../types';
import { FilterBarLayout, type FeedFilterGroup } from '@/components/feed/FilterBarLayout';
import { toggleFilter } from '@/components/feed/filterSelection';

interface OfferFilterBarProps {
  filters: OfferFeedFilters;
  onChange: (filters: OfferFeedFilters) => void;
  resultCount: number;
}

const resultLabel = (count: number): string => {
  if (count === 0) {
    return 'Aucune offre ne correspond';
  }

  return count === 1 ? '1 offre correspond' : `${count} offres correspondent`;
};

/** Candidate-specific filter data plugged into the shared recruiter-feed layout. */
export function OfferFilterBar({ filters, onChange, resultCount }: OfferFilterBarProps) {
  const changeContractTypes = (value: ContractType) =>
    onChange({
      ...filters,
      contractTypes: toggleFilter(CONTRACT_TYPE_OPTIONS, filters.contractTypes, value),
    });

  const changeRemotePolicies = (value: RemotePolicy) =>
    onChange({
      ...filters,
      remotePolicies: toggleFilter(REMOTE_POLICY_OPTIONS, filters.remotePolicies, value),
    });

  const groups: readonly FeedFilterGroup[] = [
    {
      legend: 'Type de contrat',
      options: CONTRACT_TYPE_OPTIONS,
      values: filters.contractTypes,
      onToggle: (value) => changeContractTypes(value as ContractType),
    },
    {
      legend: 'Télétravail',
      options: REMOTE_POLICY_OPTIONS,
      values: filters.remotePolicies,
      onToggle: (value) => changeRemotePolicies(value as RemotePolicy),
    },
  ];

  return (
    <FilterBarLayout
      groups={groups}
      activeCount={activeOfferFilterCount(filters)}
      resultLabel={resultLabel(resultCount)}
      onReset={() => onChange(emptyOfferFeedFilters)}
    />
  );
}
