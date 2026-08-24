import type { Option } from '@/components/form/OptionCards';
import type { MobilityScope } from './state';

export const MOBILITY_SCOPE_OPTIONS = [
  { value: 'NATIONWIDE', label: 'Toute la France' },
  { value: 'RADIUS', label: 'Autour de ma ville' },
] as const satisfies readonly Option<MobilityScope>[];
