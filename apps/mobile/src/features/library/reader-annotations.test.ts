import { describe, expect, it } from "vitest";

import {
  applyReaderAnnotationsScript,
  parseReaderAnnotationEvent,
  readerSelectionObserverScript,
  readerSelectionScript,
  scrollToReaderSearchResultScript,
} from "./reader-annotations";

describe("reader annotations", () => {
  it("parses narrowed selection and annotation messages", () => {
    expect(
      parseReaderAnnotationEvent(
        JSON.stringify({
          action: "note",
          endOffset: 12,
          selectedText: "A passage",
          startOffset: 3,
          type: "selection",
        }),
      ),
    ).toEqual({
      action: "note",
      endOffset: 12,
      selectedText: "A passage",
      startOffset: 3,
      type: "selection",
    });
    expect(
      parseReaderAnnotationEvent(
        JSON.stringify({
          action: "chatgpt",
          endOffset: 12,
          selectedText: "A passage",
          startOffset: 3,
          type: "selection",
        }),
      ),
    ).toMatchObject({ action: "chatgpt", selectedText: "A passage" });
    expect(parseReaderAnnotationEvent('{"type":"selection"}')).toBeUndefined();
    expect(
      parseReaderAnnotationEvent(
        JSON.stringify({
          action: "unhighlight",
          endOffset: 8,
          selectedText: "passage",
          startOffset: 1,
          type: "selection",
        }),
      ),
    ).toMatchObject({ action: "unhighlight", startOffset: 1, endOffset: 8 });
    expect(
      parseReaderAnnotationEvent(
        JSON.stringify({ hasHighlight: true, type: "selection-state" }),
      ),
    ).toEqual({ hasHighlight: true, type: "selection-state" });
  });

  it("builds scripts that capture and repaint stable text offsets", () => {
    expect(readerSelectionScript("highlight")).toContain("lib-reader-content");
    const observerScript = readerSelectionObserverScript();
    expect(observerScript).toContain("selectionchange");
    expect(observerScript).toContain('mark[data-lib-kind="highlight"]');
    const script = applyReaderAnnotationsScript([
      {
        bookId: "book",
        createdAt: "now",
        endOffset: 9,
        id: "saved",
        kind: "highlight",
        note: null,
        sectionId: "chapter",
        selectedText: "passage",
        startOffset: 2,
        updatedAt: "now",
      },
    ]);

    expect(script).toContain('"id":"saved"');
    expect(script).toContain("data-lib-annotation");

    const chapterNoteScript = applyReaderAnnotationsScript([
      {
        bookId: "book",
        createdAt: "now",
        endOffset: 0,
        id: "chapter-note",
        kind: "chapter-note",
        note: "A thought",
        sectionId: "chapter",
        selectedText: "",
        startOffset: 0,
        updatedAt: "now",
      },
    ]);
    expect(chapterNoteScript).not.toContain('"id":"chapter-note"');
  });

  it("builds a precise in-chapter search destination", () => {
    const script = scrollToReaderSearchResultScript({
      locationIndex: 4,
      occurrence: 1,
      query: "second mention",
    });

    expect(script).toContain('data-lib-location="4"');
    expect(script).toContain("second mention");
    expect(script).toContain("getBoundingClientRect");
  });
});
