import { describe, expect, it } from "vitest";

import {
  findBookTextMatches,
  findBookTextResults,
  nextMatchIndex,
  parseBookSearchDocuments,
} from "./book-search";

describe("book text search", () => {
  const documents = [
    { position: 1, text: "Chapter one" },
    { position: 4, text: "Chapter three starts here. Chapter three." },
    { position: 9, text: "The end" },
  ];

  it("loads only valid persisted search documents", () => {
    expect(
      parseBookSearchDocuments('[{"position":1,"text":"A passage"}]'),
    ).toEqual([{ position: 1, text: "A passage" }]);
    expect(parseBookSearchDocuments('[{"position":"1","text":3}]')).toBe(
      undefined,
    );
  });

  it("finds every case-insensitive occurrence", () => {
    expect(findBookTextMatches(documents, "chapter")).toEqual([
      { position: 1 },
      { position: 4 },
      { position: 4 },
    ]);
  });

  it("starts at the nearest result and wraps", () => {
    const matches = findBookTextMatches(documents, "chapter");
    expect(nextMatchIndex(matches, -1, 3, 1)).toBe(1);
    expect(nextMatchIndex(matches, -1, 3, -1)).toBe(0);
    expect(nextMatchIndex(matches, 2, 3, 1)).toBe(0);
    expect(nextMatchIndex(matches, 0, 3, -1)).toBe(2);
  });

  it("builds snippets and tracks each occurrence within its document", () => {
    expect(findBookTextResults(documents, "chapter")).toEqual([
      { occurrence: 0, position: 1, snippet: "Chapter one" },
      {
        occurrence: 0,
        position: 4,
        snippet: "Chapter three starts here. Chapter three.",
      },
      {
        occurrence: 1,
        position: 4,
        snippet: "Chapter three starts here. Chapter three.",
      },
    ]);
  });
});
