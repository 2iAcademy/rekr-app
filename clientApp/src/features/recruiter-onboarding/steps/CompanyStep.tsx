import { CityField } from '@/components/form/CityField';
import { OptionCards } from '@/components/form/OptionCards';
import { SectorField } from '../components/SectorField';
import { TextField } from '@/components/form/TextField';
import { COMPANY_SIZE_OPTIONS } from '@/domain/options';
import {
  markGroupIfInvalid,
  markIfInvalid,
  WIZARD_ERROR_ID,
} from '@/components/wizard/wizardError';
import type { StepProps } from './stepProps';

export function CompanyStep({ state, onChange, invalidField }: StepProps) {
  return (
    <>
      <TextField
        label="Nom de la société"
        aria-required
        {...markIfInvalid(invalidField, 'companyName')}
        autoComplete="organization"
        maxLength={255}
        value={state.companyName}
        onChange={(event) => onChange({ companyName: event.target.value })}
        placeholder="Studio Lumen"
      />

      <SectorField
        value={state.sectorId}
        onChange={(sectorId) => onChange({ sectorId })}
        invalid={invalidField === 'sectorId'}
        describedBy={invalidField === 'sectorId' ? WIZARD_ERROR_ID : undefined}
      />

      <OptionCards
        legend="Taille"
        name="company-size"
        options={COMPANY_SIZE_OPTIONS}
        value={state.size}
        onChange={(size) => onChange({ size })}
        columns={2}
        invalid={invalidField === 'size'}
        describedBy={invalidField === 'size' ? WIZARD_ERROR_ID : undefined}
      />

      <CityField
        label="Ville"
        selected={
          state.city && state.postalCode ? { name: state.city, postalCode: state.postalCode } : null
        }
        onSelect={(city) =>
          onChange({
            city: city.name,
            postalCode: city.postalCode,
          })
        }
        onClear={() => onChange({ city: '', postalCode: '' })}
        {...markGroupIfInvalid(invalidField, 'city')}
      />

      <TextField
        label="Site web (optionnel)"
        type="url"
        autoComplete="url"
        maxLength={255}
        value={state.siteUrl}
        onChange={(event) => onChange({ siteUrl: event.target.value })}
        placeholder="https://studiolumen.fr"
      />
    </>
  );
}
