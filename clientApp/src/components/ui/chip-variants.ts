import { cva } from 'class-variance-authority';

/**
 * Exported as a recipe rather than a component: the offer detail lays its chips
 * out as `span`s and the candidate card as `li`s inside a named list, and
 * forcing one element on both would cost an extra DOM node in the flex row.
 *
 * `brand` is the subject's own words (skills, stack), `role` is the reader's
 * accent (contracts, languages) and follows the `data-role` palette.
 */
export const chipVariants = cva('px-3 font-medium', {
  variants: {
    size: {
      sm: 'rounded-full py-1 text-xs',
      md: 'rounded-[0.9375rem] py-1.5 text-sm break-words',
    },
    tone: {
      brand: 'bg-brand-tint text-brand-strong',
      role: 'bg-role/10 text-role',
    },
  },
  defaultVariants: {
    size: 'md',
    tone: 'brand',
  },
});
