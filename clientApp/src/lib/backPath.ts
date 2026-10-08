/**
 * Where the reader was before they opened this screen, when the screen that sent
 * them here said so. Navigation state is client data: anyone can arrive with
 * anything in it, so only an internal path is followed — an absolute or
 * protocol-relative URL would turn a back button into an open redirect.
 */
export const backPath = (state: unknown, fallback: string): string => {
  const from = (state as { from?: unknown } | null)?.from;

  if (typeof from !== 'string' || !from.startsWith('/')) {
    return fallback;
  }

  return from.startsWith('//') || from.startsWith('/\\') ? fallback : from;
};
