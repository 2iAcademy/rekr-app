/**
 * Single wizard per screen, so a constant id is enough to point every field at
 * the one alert rendered by `WizardShell`.
 */
export const WIZARD_ERROR_ID = 'wizard-error';

interface InvalidMarkers {
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface InvalidGroupMarkers {
  invalid: boolean;
  describedBy: string | undefined;
}

export const markIfInvalid = <Field extends string>(
  invalidField: Field | null | undefined,
  field: Field,
): InvalidMarkers => {
  const invalid = invalidField === field;

  return {
    'aria-invalid': invalid,
    'aria-describedby': invalid ? WIZARD_ERROR_ID : undefined,
  };
};

// Fieldset-like components (`OptionCards`, `OptionChips`, `TagInput`) own their
// ARIA wiring, so they take plain props rather than attributes to spread.
export const markGroupIfInvalid = <Field extends string>(
  invalidField: Field | null | undefined,
  field: Field,
): InvalidGroupMarkers => {
  const invalid = invalidField === field;

  return { invalid, describedBy: invalid ? WIZARD_ERROR_ID : undefined };
};
