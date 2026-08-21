/** Converts a storage key returned by the API into its public read URL. */
export const fileUrl = (key: string | null | undefined): string | null =>
  key ? `/api/files/${key}` : null;
