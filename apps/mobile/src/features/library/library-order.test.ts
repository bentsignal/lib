import { describe, expect, it } from "vitest";

import type { BookRecord } from "@lib/ebook-core";

import { libraryTopPadding, sortBooksByRecentOpen } from "./library-order";

describe("library ordering", () => {
  const books = [
    book("new", "2026-08-24T12:00:00.000Z"),
    book("middle", "2026-08-23T12:00:00.000Z"),
    book("old", "2026-08-22T12:00:00.000Z"),
  ];

  it("puts opened books first by their most recent activity", () => {
    expect(
      sortBooksByRecentOpen(books, [
        { bookId: "old", updatedAt: "2026-08-24T15:00:00.000Z" },
        { bookId: "middle", updatedAt: "2026-08-24T16:00:00.000Z" },
      ]).map(({ id }) => id),
    ).toEqual(["middle", "old", "new"]);
  });

  it("keeps never-opened books in import order", () => {
    expect(sortBooksByRecentOpen(books, []).map(({ id }) => id)).toEqual([
      "new",
      "middle",
      "old",
    ]);
  });
});

describe("library top padding", () => {
  it("keeps the first shelf row below the safe area", () => {
    expect(libraryTopPadding(59)).toBe(67);
  });

  it("keeps a small gutter when the inset is unavailable", () => {
    expect(libraryTopPadding(-10)).toBe(8);
  });
});

function book(id: string, importedAt: string) {
  return {
    format: "epub",
    id,
    importedAt,
    modifiedAt: importedAt,
    sections: [],
    sourceFileName: `${id}.epub`,
    title: id,
  } satisfies BookRecord;
}
