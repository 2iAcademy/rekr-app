export const normalizeEmail = (value: string): string => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }

  return value;
};
