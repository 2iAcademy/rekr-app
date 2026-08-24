import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import type { NavigationItem } from './navigation';

interface MobileNavMenuProps {
  items: NavigationItem[];
  onClose: () => void;
}

export function MobileNavMenu({ items, onClose }: MobileNavMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Opening modally is what a hand-rolled trap could only pretend to do: the
  // browser puts the panel in the top layer, makes the rest of the document
  // inert, stops it from scrolling, keeps Tab inside, and turns Escape into a
  // `cancel` event.
  useEffect(() => {
    const dialog = dialogRef.current;

    dialog?.showModal();
    closeButtonRef.current?.focus();

    // Giving the dialog back on cleanup keeps `StrictMode`'s effect replay from
    // re-opening an already-open dialog, which throws.
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Menu de navigation"
      // The parent owns the panel's lifetime, so the browser must not close the
      // dialog behind its back: cancelling here and closing through `onClose`
      // keeps a single source of truth for whether the menu exists.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the `::backdrop` is dispatched on the dialog itself, whereas
      // a click inside the panel targets the content below.
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      className="fixed inset-y-0 left-0 m-0 h-full max-h-full w-72 max-w-[85%] bg-card shadow-xl backdrop:bg-ink/30 md:hidden"
    >
      <div className="flex h-full flex-col px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Logo size="sm" />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Fermer le menu"
            onClick={onClose}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-brand-tint"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav aria-label="Navigation du menu" className="mt-8 min-w-0">
          <ul className="flex flex-col gap-1 text-sm text-ink-muted">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      'flex min-h-11 min-w-11 items-center rounded-lg px-3 py-2 transition-colors',
                      isActive
                        ? 'bg-brand-tint font-semibold text-brand-strong'
                        : 'hover:bg-brand-tint',
                    ].join(' ')
                  }
                >
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </dialog>
  );
}
