export type ApiKeyMasked<T extends { apiKey?: string | null }> = Omit<T, "apiKey"> & {
  apiKeySet: boolean;
};

/** Strip apiKey from API responses; expose apiKeySet only. */
export function stripApiKeyFromResponse<T extends { apiKey?: string | null }>(
  row: T,
): ApiKeyMasked<T> {
  const { apiKey, ...rest } = row;
  return {
    ...rest,
    apiKeySet: !!apiKey?.trim(),
  };
}
