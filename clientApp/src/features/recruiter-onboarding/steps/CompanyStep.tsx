import { OptionCards } from '@/components/form/OptionCards';
import { SectorField } from '../components/SectorField';
import { TextField } from '../components/TextField';
import { COMPANY_SIZE_OPTIONS } from '../options';
import { markIfInvalid, WIZARD_ERROR_ID, type StepProps } from './stepProps';

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

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <TextField
          label="Ville"
          aria-required
          {...markIfInvalid(invalidField, 'city')}
          autoComplete="address-level2"
          maxLength={100}
          value={state.city}
          onChange={(event) => onChange({ city: event.target.value })}
          placeholder="Lyon"
        />
        <TextField
          label="Code postal"
          aria-required
          {...markIfInvalid(invalidField, 'postalCode')}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={10}
          value={state.postalCode}
          onChange={(event) => onChange({ postalCode: event.target.value })}
          placeholder="69003"
        />
      </div>

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
