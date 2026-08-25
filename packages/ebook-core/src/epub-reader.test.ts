import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type { BookSection, EpubLocation } from "./model";
import { createEpubReaderSession } from "./epub-reader";
import { extractEpubLocationTexts } from "./epub-search";

describe("createEpubReaderSession", () => {
  it("reuses an opened archive to render multiple sections", async () => {
    const archive = new JSZip();
    archive.file(
      "one.xhtml",
      "<html><body><h1>Publisher heading</h1><p>First chapter</p></body></html>",
    );
    archive.file(
      "two.xhtml",
      "<html><body><p>Second chapter</p></body></html>",
    );
    const session = await createEpubReaderSession(
      await archive.generateAsync({ type: "uint8array" }),
    );
    const locations = [location("one.xhtml", 0), location("two.xhtml", 1)];
    const first = await session.buildSectionHtml(
      section("Metadata title", "one.xhtml", 0),
      locations,
      theme,
    );
    const second = await session.buildSectionHtml(
      section("two", "two.xhtml", 1),
      locations,
      theme,
    );

    expect(first).toContain("First chapter");
    expect(first).toContain("Publisher heading");
    expect(first).not.toContain("Metadata title");
    expect(first).not.toContain("lib-chapter-title");
    expect(first).toContain('id="lib-reader-content"');
    expect(first).toContain('data-lib-location="0"');
    expect(second).toContain("Second chapter");
  });

  it("extracts complete searchable text instead of stored excerpts", async () => {
    const archive = new JSZip();
    archive.file(
      "one.xhtml",
      `<html><body><p>${"Beginning ".repeat(30)}hidden ending</p></body></html>`,
    );
    const source = await archive.generateAsync({ type: "uint8array" });
    const texts = await extractEpubLocationTexts(source, [
      {
        endOffset: 353,
        excerpt: "Beginning",
        href: "one.xhtml",
        index: 0,
        startOffset: 0,
        title: "One",
      },
    ]);

    expect(texts[0]).toContain("hidden ending");
    expect(texts[0]?.length).toBeGreaterThan(180);
  });
});

function section(id: string, href: string, index: number) {
  return {
    endLocation: index,
    href,
    id,
    included: true,
    startLocation: index,
    title: id,
  } satisfies BookSection;
}

function location(href: string, index: number) {
  return { excerpt: "", href, index, title: href } satisfies EpubLocation;
}

const theme = { background: "#fff", foreground: "#111", muted: "#aaa" };
