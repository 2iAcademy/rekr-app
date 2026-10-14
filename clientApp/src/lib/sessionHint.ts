const SESSION_HINT_KEY = 'rekr:has-session';

/**
 * Whether this browser opened a session that a reload could restore.
 *
 * The refresh cookie is httpOnly, so the page cannot see it. Without this
 * hint, every first visit would call /api/auth/refresh and get a 401 that the
 * browser logs as an error, although nothing went wrong. The hint is a flag,
 * not a credential: the cookie still decides whether the session comes back.
 *
 * Storage can throw (private mode, blocked site data). A missing hint only
 * means one more login, so every failure reads as "no session".
 */
export const hasSessionHint = (): boolean => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

export const setSessionHint = (): void => {
  try {
    localStorage.setItem(SESSION_HINT_KEY, '1');
  } catch {
    // Nothing to do: the next reload asks for a login.
  }
};

export const clearSessionHint = (): void => {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Nothing to do: the next boot gets a 401 and clears the state anyway.
  }
};
