// Number inputs are plain text boxes: `type="number"` brings spinners, a locale
// dependent decimal separator and a value that reads empty when it is invalid.
export const digitsOnly = (value: string): string => value.replace(/\D/g, '');
