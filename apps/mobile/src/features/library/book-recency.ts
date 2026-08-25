import { Storage } from "expo-sqlite/kv-store";

const storageKey = "lib:recently-opened-books";

let openedAt = parseActivity(Storage.getItemSync(storageKey));
const listeners = new Set<() => void>();

export function recordBookOpened(bookId: string) {
  openedAt = { ...openedAt, [bookId]: new Date().toISOString() };
  for (const listener of listeners) listener();
  void Storage.setItemAsync(storageKey, JSON.stringify(openedAt)).catch(
    () => undefined,
  );
}

export function subscribeToBookOpenActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBookOpenActivity(
  fallback: { bookId: string; updatedAt: string }[],
) {
  const activity = new Map(
    fallback.map((entry) => [entry.bookId, entry.updatedAt]),
  );
  for (const [bookId, updatedAt] of Object.entries(openedAt)) {
    activity.set(bookId, updatedAt);
  }
  return [...activity].map(([bookId, updatedAt]) => ({ bookId, updatedAt }));
}

function parseActivity(value: string | null) {
  if (!value) return emptyActivity();
  try {
    // eslint-disable-next-line no-restricted-syntax -- Persisted JSON must be narrowed before its values are used as timestamps.
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyActivity();
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return emptyActivity();
  }
}

function emptyActivity() {
  return Object.fromEntries<string>([]);
}
