import { Children, isValidElement, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Accordion } from '@base-ui/react/accordion';
import { cn } from '@/lib/utils';

interface ProfileSectionProps {
  /** Stable identifier, used by `defaultOpen`. */
  value: string;
  title: string;
  children: ReactNode;
}

interface ProfileSectionsProps {
  /** Sections open on arrival. Defaults to the first one declared. */
  defaultOpen?: string[];
  children: ReactNode;
}

/**
 * The collapsible frame the two profile screens are built on.
 *
 * Both were a single linear form — nineteen blocks on the candidate side — that
 * had to be scrolled through in full to reach the save button. Grouping them
 * lets a reader open the part they came for and leave the rest folded.
 *
 * Two rules the form imposes on the accordion:
 *
 * - several sections stay open at once (`multiple`), because auto-folding
 *   the one just filled in would hide an entry still being typed;
 * - the panels are kept mounted, because a field unmounted by a fold would lose
 *   its value and the form would save an empty column.
 */
/**
 * The first section declared, so the caller does not have to repeat an
 * identifier it already wrote just to say « open this one ». A screen that
 * arrives entirely folded shows none of what the reader came for.
 */
const firstValue = (children: ReactNode): string[] => {
  for (const child of Children.toArray(children)) {
    if (isValidElement<ProfileSectionProps>(child)) {
      return [child.props.value];
    }
  }

  return [];
};

export function ProfileSections({ defaultOpen, children }: ProfileSectionsProps) {
  return (
    <Accordion.Root
      multiple
      defaultValue={defaultOpen ?? firstValue(children)}
      className="mt-6 flex flex-col gap-3"
    >
      {children}
    </Accordion.Root>
  );
}

export function ProfileSection({ value, title, children }: ProfileSectionProps) {
  return (
    <Accordion.Item
      value={value}
      className="overflow-hidden rounded-2xl border border-line bg-card"
    >
      <Accordion.Header className="m-0">
        <Accordion.Trigger
          className={cn(
            'flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left',
            'font-heading text-base font-semibold text-ink transition-colors hover:bg-brand-tint/40',
            'outline-none focus-visible:ring-3 focus-visible:ring-role/40',
          )}
        >
          {title}
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-data-[panel-open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      {/* `keepMounted` is what makes a folded field keep its value. */}
      <Accordion.Panel keepMounted className="data-[closed]:hidden">
        <div className="flex flex-col gap-5 border-t border-line px-5 py-5">{children}</div>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
