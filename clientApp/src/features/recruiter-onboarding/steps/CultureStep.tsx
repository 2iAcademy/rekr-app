import { RichTextField } from '@/components/form/RichTextField';
import { MAX_FREE_TEXT_LENGTH } from '@/lib/bounds';
import { markIfInvalid } from '@/components/wizard/wizardError';
import type { StepProps } from './stepProps';

export function CultureStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Cette présentation est visible par tous les candidats, avant même un match.
      </p>

      <RichTextField
        label="Présentation de la société"
        aria-required
        {...markIfInvalid(invalidField, 'description')}
        maxLength={MAX_FREE_TEXT_LENGTH}
        value={state.description}
        onChange={(description) => onChange({ description })}
        placeholder="Votre métier, votre façon de travailler, ce que vous offrez…"
      />
    </>
  );
}
