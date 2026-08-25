import type { ContractType } from '@/domain/enums';
import { CONTRACT_TYPE_OPTIONS } from '@/domain/options';

const labelOf = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string => options.find((option) => option.value === value)?.label ?? value;

export const contractLabel = (type: ContractType): string => labelOf(CONTRACT_TYPE_OPTIONS, type);

export const metaLine = (parts: readonly (string | null | undefined)[]): string =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ');
