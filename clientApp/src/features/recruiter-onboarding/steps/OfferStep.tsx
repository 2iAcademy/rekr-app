import { RichTextField } from '../components/RichTextField';
import { TagInput } from '../components/TagInput';
import { TextField } from '../components/TextField';
import { MAX_FREE_TEXT_LENGTH } from '../bounds';
import { markIfInvalid, WIZARD_ERROR_ID, type StepProps } from './stepProps';

export function OfferStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <TextField
        label="Titre du poste"
        aria-required
        {...markIfInvalid(invalidField, 'offerTitle')}
        maxLength={255}
        value={state.offerTitle}
        onChange={(event) => onChange({ offerTitle: event.target.value })}
        placeholder="Chargé de clientèle"
      />

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <TextField
          label="Ville"
          aria-required
          {...markIfInvalid(invalidField, 'offerCity')}
          autoComplete="address-level2"
          maxLength={100}
          value={state.offerCity}
          onChange={(event) => onChange({ offerCity: event.target.value })}
          placeholder="Lyon"
        />
        <TextField
          label="Code postal"
          aria-required
          {...markIfInvalid(invalidField, 'offerPostalCode')}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={10}
          value={state.offerPostalCode}
          onChange={(event) => onChange({ offerPostalCode: event.target.value })}
          placeholder="69003"
        />
      </div>

      <RichTextField
        label="Missions"
        aria-required
        {...markIfInvalid(invalidField, 'offerDescription')}
        maxLength={MAX_FREE_TEXT_LENGTH}
        value={state.offerDescription}
        onChange={(offerDescription) => onChange({ offerDescription })}
        placeholder="Le quotidien du poste, l’équipe, les responsabilités…"
      />

      <TagInput
        label="Compétences recherchées"
        placeholder="Relation client, organisation, anglais…"
        values={state.skills}
        onChange={(skills) => onChange({ skills })}
        invalid={invalidField === 'skills'}
        describedBy={invalidField === 'skills' ? WIZARD_ERROR_ID : undefined}
      />
    </>
  );
}
