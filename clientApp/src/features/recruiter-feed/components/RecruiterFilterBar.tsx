import type { ContractType, ExperienceLevel } from '@/domain/enums';
import { CONTRACT_TYPE_OPTIONS, EXPERIENCE_LEVEL_OPTIONS } from '@/domain/options';
import { activeFilterCount } from '../filters';
import { emptyFeedFilters, type FeedFilters } from '../types';
import { FilterBarLayout, type FeedFilterGroup } from '@/components/feed/FilterBarLayout';
import { toggleFilter } from '@/components/feed/filterSelection';

interface RecruiterFilterBarProps {
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
  resultCount: number;
}

const resultLabel = (count: number): string => {
  if (count === 0) {
    return 'Aucun profil ne correspond';
  }

  return count === 1 ? '1 profil correspond' : `${count} profils correspondent`;
};

/** Recruiter-specific filter data plugged into the shared filter-bar layout. */
export const RecruiterFilterBar = ({ filters, onChange, resultCount }: RecruiterFilterBarProps) => {
  const changeContractTypes = (value: ContractType) =>
    onChange({
      ...filters,
      contractTypes: toggleFilter(CONTRACT_TYPE_OPTIONS, filters.contractTypes, value),
    });

  const changeExperienceLevels = (value: ExperienceLevel) =>
    onChange({
      ...filters,
      experienceLevels: toggleFilter(EXPERIENCE_LEVEL_OPTIONS, filters.experienceLevels, value),
    });

  const groups: readonly FeedFilterGroup[] = [
    {
      legend: 'Type de contrat',
      options: CONTRACT_TYPE_OPTIONS,
      values: filters.contractTypes,
      onToggle: (value) => changeContractTypes(value as ContractType),
    },
    {
      legend: "Niveau d'expérience",
      options: EXPERIENCE_LEVEL_OPTIONS,
      values: filters.experienceLevels,
      onToggle: (value) => changeExperienceLevels(value as ExperienceLevel),
    },
  ];

  return (
    <FilterBarLayout
      groups={groups}
      activeCount={activeFilterCount(filters)}
      resultLabel={resultLabel(resultCount)}
      onReset={() => onChange(emptyFeedFilters)}
    />
  );
};
