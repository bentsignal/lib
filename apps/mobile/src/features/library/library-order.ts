import type { BookRecord } from "@lib/ebook-core";

export function libraryTopPadding(safeAreaTop: number) {
  return Math.max(0, safeAreaTop) + 8;
}

export function sortBooksByRecentOpen(
  books: BookRecord[],
  activity: { bookId: string; updatedAt: string }[],
) {
  const openedAt = new Map(
    activity.map((entry) => [entry.bookId, entry.updatedAt]),
  );
  return [...books].sort((left, right) => {
    const leftOpened = openedAt.get(left.id);
    const rightOpened = openedAt.get(right.id);
    if (leftOpened && rightOpened) return rightOpened.localeCompare(leftOpened);
    if (leftOpened) return -1;
    if (rightOpened) return 1;
    return right.importedAt.localeCompare(left.importedAt);
  });
}
