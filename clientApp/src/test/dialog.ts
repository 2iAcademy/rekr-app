import { afterAll, beforeEach } from 'vitest';

/**
 * jsdom 29 ships `HTMLDialogElement` with the `open` attribute and nothing else:
 * its implementation class is empty, so `showModal`, `close` and the `cancel`
 * event do not exist.
 *
 * This double only toggles `open` — the attribute the UA stylesheet keys
 * `dialog:not([open]) { display: none }` on — so a panel can mount and be
 * queried. It simulates none of what `showModal` actually buys (top layer,
 * inert background, scroll lock, focus trap): those are platform guarantees
 * now, and no spec asserts on them.
 *
 * It lives here rather than in each spec because the two copies it replaces had
 * already drifted apart — only one of them threw on a double open, so only one
 * of them could catch the StrictMode effect replay.
 *
 * Returns the dialogs opened modally, in order, so a spec can tell `showModal`
 * from `show`.
 */
export function installDialogDouble(): { openedAsModal: HTMLDialogElement[] } {
  const openedAsModal: HTMLDialogElement[] = [];

  beforeEach(() => {
    openedAsModal.length = 0;

    Object.assign(HTMLDialogElement.prototype, {
      showModal(this: HTMLDialogElement) {
        // Faithful to the spec on the one point that matters here: opening an
        // already-open dialog throws, which is what surfaces a duplicated call.
        if (this.open) {
          throw new Error('InvalidStateError: the dialog is already open');
        }

        openedAsModal.push(this);
        this.setAttribute('open', '');
      },
      close(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
  });

  // Removed only once the file is done: Testing Library unmounts the panel —
  // and runs the effect cleanup that calls `close` — after the spec's own
  // `afterEach`.
  afterAll(() => {
    const prototype = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;

    delete prototype.showModal;
    delete prototype.close;
  });

  return { openedAsModal };
}
