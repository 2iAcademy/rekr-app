interface ChipListProps {
  label: string;
  items: readonly string[];
  chipClassName: string;
}

/**
 * Named on the list itself rather than by a heading: the card carries no visible
 * rubric at all, and on the detail screen the heading next to the list still does
 * not name it for assistive technology.
 *
 * An empty list renders nothing rather than an announced "list, 0 items". A caller
 * that also has a rubric to hide has to guard on its own side.
 */
export function ChipList({ label, items, chipClassName }: ChipListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className={chipClassName}>
          {item}
        </li>
      ))}
    </ul>
  );
}
