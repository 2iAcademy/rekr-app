import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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

afterEach(() => {
  cleanup();
  execCommand.mockClear();
});
