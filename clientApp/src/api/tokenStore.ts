type Listener = () => void;

/**
 * The access token lives in memory and nowhere else — no localStorage, no
 * cookie readable by scripts. A page reload therefore loses it, which is the
 * intent: the httpOnly refresh cookie survives instead, and the app mints a new
 * access token silently at boot.
 *
 * This module knows nothing about React on purpose. `customFetch` is a plain
 * function and cannot read a context, so the holder has to sit outside the
 * component tree; the provider syncs into it.
 */
let accessToken: string | null = null;
const listeners = new Set<Listener>();

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

export const onSessionExpired = (listener: Listener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifySessionExpired = (): void => {
  listeners.forEach((listener) => listener());
};
