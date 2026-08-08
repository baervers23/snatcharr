/** Session-storage key for disclaimer dismiss — safe for emoji / Unicode. */
export function popupDismissStorageKey(text: string): string {
  return `info-popup-dismissed-${encodeURIComponent(text.slice(0, 200))}`;
}
