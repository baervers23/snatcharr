/** Row with apiKey removed from client payloads — only whether one is stored. */
export type ApiKeyMasked<T extends { apiKey?: string | null }> = Omit<T, "apiKey"> & {
  apiKeySet: boolean;
};

/** Never expose apiKey in API responses — only whether one is stored. */
export function stripApiKeyFromResponse<T extends { apiKey?: string | null }>(
  row: T,
): ApiKeyMasked<T> {
  const { apiKey, ...rest } = row;
  return {
    ...rest,
    apiKeySet: !!apiKey?.trim(),
  };
}
