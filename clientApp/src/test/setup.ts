import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';

/**
 * jsdom implements neither `execCommand` nor `contentEditable` editing, so the
 * rich text field would throw on every formatting command.
 *
 * This double only does what jsdom can honour: it records the command, and
 * inserts plain text for `insertText`. It deliberately does **not** simulate
 * bold, italic or lists — a test asserting on those would be asserting on this
 * stub, not on the browser. Those are verified in a real browser.
 */
const execCommand = vi.fn((command: string, _ui?: boolean, value?: string): boolean => {
  const target = document.activeElement;

  if (command === 'insertText' && target instanceof HTMLElement && target.isContentEditable) {
    target.textContent = `${target.textContent ?? ''}${value ?? ''}`;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return true;
});

Object.defineProperty(document, 'execCommand', {
  value: execCommand,
  writable: true,
  configurable: true,
});

/**
 * Sonner's toast store is a module-level singleton that outlives `cleanup()`,
 * and `ToastState.subscribe` replays every still-active toast to any newly
 * mounted `<Toaster>`. A toast raised in one test is never dismissed — its
 * Toaster is unmounted long before the auto-close timer fires — so it would
 * reappear in the next test and break assertions that expect no toast at all.
 *
 * Dismissing marks them in `dismissedToasts`, which is what `getActiveToasts`
 * filters on, so the replay finds nothing. This is deterministic: it does not
 * depend on timers running.
 */
afterEach(() => {
  toast.dismiss();
  cleanup();
  toast.dismiss();
  execCommand.mockClear();
});
