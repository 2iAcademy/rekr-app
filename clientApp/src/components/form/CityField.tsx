import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cityControllerSearch, type CityDto } from '@/api/generated';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// The reference itself refuses a shorter query, and a two-letter prefix matches
// half of France anyway.
const MIN_QUERY_LENGTH = 3;
const DEFAULT_DEBOUNCE_MS = 300;

export interface SelectedCity {
  name: string;
  postalCode: string;
}

interface CityFieldProps {
  label: string;
  selected: SelectedCity | null;
  onSelect: (city: CityDto) => void;
  onClear: () => void;
  invalid?: boolean;
  describedBy?: string;
  debounceMs?: number;
}

const format = (city: SelectedCity): string => `${city.name} (${city.postalCode})`;

export function CityField({
  label,
  selected,
  onSelect,
  onClear,
  invalid,
  describedBy,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: CityFieldProps) {
  const fieldId = useId();
  const listId = useId();
  const helpId = useId();
  const [query, setQuery] = useState(() => (selected ? format(selected) : ''));
  const [cities, setCities] = useState<CityDto[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Set while the field itself rewrites the query, so the effect below does not
  // search for the label it has just written.
  const silent = useRef(true);
  // Only the answer to the latest query may win: a slow request for « ly » must
  // not overwrite the results of « lyon ».
  const latestQuery = useRef('');

  useEffect(() => {
    /**
     * Nothing to search for a query that is already the label of the selected
     * commune: it is what this field wrote itself, not something a user typed.
     *
     * Checked here and not only through the `silent` flag below, because that
     * flag is spent on the first run of the effect — and an effect runs twice
     * under StrictMode. The second run used to open the suggestion list on a
     * pre-filled field, before anyone had touched it.
     */
    if (selected !== null && query === format(selected)) {
      return;
    }

    if (silent.current) {
      silent.current = false;
      return;
    }

    // Closing the list for a too-short query is done by `handleChange`, which
    // is where the typing happens: an effect must not set state on its own.
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return;
    }

    const wanted = query.trim();
    latestQuery.current = wanted;

    const timer = setTimeout(() => {
      cityControllerSearch({ q: wanted })
        .then((response) => {
          if (latestQuery.current === wanted) {
            setCities(response.data);
            setActiveIndex(-1);
          }
        })
        .catch(() => {
          if (latestQuery.current === wanted) {
            setCities([]);
          }
        });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, selected]);

  const close = (): void => {
    setCities(null);
    setActiveIndex(-1);
  };

  const choose = (city: CityDto): void => {
    silent.current = true;
    setQuery(format(city));
    latestQuery.current = '';
    close();
    onSelect(city);
  };

  const handleChange = (value: string): void => {
    setQuery(value);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      close();
    }
    if (selected) {
      onClear();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!cities || cities.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + step;
        if (next < 0) {
          return cities.length - 1;
        }

        return next >= cities.length ? 0 : next;
      });
      return;
    }

    // Enter inside a wizard step would otherwise submit the whole form.
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(cities[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      close();
    }
  };

  const expanded = cities !== null;
  const optionId = (index: number): string => `${listId}-${String(index)}`;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs text-ink-muted">
        {label}
      </label>
      <Input
        id={fieldId}
        role="combobox"
        autoComplete="off"
        aria-required
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={invalid}
        aria-describedby={[helpId, describedBy].filter(Boolean).join(' ')}
        value={query}
        placeholder="Lyon"
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <p id={helpId} className="text-xs text-ink-faint">
        Choisissez votre commune dans la liste : elle renseigne aussi le code postal.
      </p>

      {expanded && cities.length === 0 && (
        <p className="text-xs text-ink-muted">Aucune commune trouvée.</p>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        className={cn(
          'absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-line bg-card shadow-lg',
          expanded && cities.length > 0 ? 'block' : 'hidden',
        )}
      >
        {(cities ?? []).map((city, index) => (
          <li
            key={`${city.name}-${city.postalCode}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            // `onMouseDown`: a click would blur the input first, and a blur that
            // closes the list would remove the option before the click lands.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(city);
            }}
            className={cn(
              'cursor-pointer px-4 py-2.5 text-sm text-ink',
              index === activeIndex ? 'bg-brand-tint' : 'hover:bg-muted',
            )}
          >
            {format({ name: city.name, postalCode: city.postalCode })}
          </li>
        ))}
      </ul>
    </div>
  );
}
