import { RichTextField } from '../components/RichTextField';
import { TagInput } from '../components/TagInput';
import { MAX_FREE_TEXT_LENGTH } from '../bounds';
import { markIfInvalid, type StepProps } from './stepProps';

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

      <TagInput
        label="Avantages (optionnel)"
        placeholder="Mutuelle, tickets resto, RTT…"
        values={state.benefits}
        onChange={(benefits) => onChange({ benefits })}
      />
    </>
  );
}
