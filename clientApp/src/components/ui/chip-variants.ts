import { cva } from 'class-variance-authority';

/**
 * Exported as a recipe rather than a component: the offer detail lays its chips
 * out as `span`s and the candidate card as `li`s inside a named list, and
 * forcing one element on both would cost an extra DOM node in the flex row.
 *
 * `neutral` is the subject's own words (skills, stack); `accent` is what the
 * reader filters on (contracts, languages) and takes the accent tint.
 */
export const chipVariants = cva('px-3 font-medium', {
  variants: {
    size: {
      sm: 'rounded-full py-1 text-xs',
      md: 'min-w-0 rounded-lg py-1 text-[0.8125rem] break-words',
    },
    tone: {
      neutral: 'bg-surface text-ink-soft font-semibold',
      accent: 'bg-brand-tint text-brand-strong font-semibold',
    },
  },
  defaultVariants: {
    size: 'md',
    tone: 'neutral',
  },
});

export const SKILL_CHIP = chipVariants({ tone: 'neutral' });
export const TAG_CHIP = chipVariants({ tone: 'accent' });
