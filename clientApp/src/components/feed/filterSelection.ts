type FilterOption = Readonly<{ value: string }>;
type OptionValue<TOptions extends readonly FilterOption[]> = TOptions[number]['value'];

export const toggleFilter = <TOptions extends readonly FilterOption[]>(
  options: TOptions,
  values: readonly OptionValue<TOptions>[],
  value: OptionValue<TOptions>,
): OptionValue<TOptions>[] => {
  const next = values.includes(value)
    ? values.filter((kept) => kept !== value)
    : [...values, value];

  return options.map((option) => option.value).filter((option) => next.includes(option));
};
