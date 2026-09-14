import { CityField } from '@/components/form/CityField';
import { RichTextField } from '@/components/form/RichTextField';
import { TagInput } from '@/components/form/TagInput';
import { TextField } from '@/components/form/TextField';
import { MAX_FREE_TEXT_LENGTH } from '@/lib/bounds';
import {
  markGroupIfInvalid,
  markIfInvalid,
  WIZARD_ERROR_ID,
} from '@/components/wizard/wizardError';
import type { StepProps } from './stepProps';

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

      <CityField
        label="Ville du poste"
        selected={
          state.offerCity && state.offerPostalCode
            ? { name: state.offerCity, postalCode: state.offerPostalCode }
            : null
        }
        onSelect={(city) =>
          onChange({
            offerCity: city.name,
            offerPostalCode: city.postalCode,
          })
        }
        onClear={() =>
          onChange({
            offerCity: '',
            offerPostalCode: '',
          })
        }
        {...markGroupIfInvalid(invalidField, 'offerCity')}
      />

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

      <TagInput
        label="Avantages (optionnel)"
        placeholder="Mutuelle, tickets resto, RTT…"
        values={state.benefits}
        onChange={(benefits) => onChange({ benefits })}
      />
    </>
  );
}
