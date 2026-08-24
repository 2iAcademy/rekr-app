export const toggleFilter = <T extends string>(
  options: readonly { value: T }[],
  values: readonly T[],
  value: T,
): T[] => {
  const next = values.includes(value)
    ? values.filter((kept) => kept !== value)
    : [...values, value];

  return options.map((option) => option.value).filter((option) => next.includes(option));
};
