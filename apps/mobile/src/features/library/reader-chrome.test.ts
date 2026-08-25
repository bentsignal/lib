import { describe, expect, it } from "vitest";

import {
  parseReaderChromeEvent,
  readerChromePressScript,
  readerChromeScrollScript,
} from "./reader-chrome";

describe("reader chrome", () => {
  it("parses reader surface presses", () => {
    expect(parseReaderChromeEvent('{"type":"reader-press"}')).toEqual({
      type: "reader-press",
    });
    expect(parseReaderChromeEvent('{"type":"selection"}')).toBeUndefined();
    expect(parseReaderChromeEvent("not json")).toBeUndefined();
  });

  it("ignores selections and interactive chapter content", () => {
    const script = readerChromePressScript();

    expect(script).toContain("touchstart");
    expect(script).toContain("selectionAtPressStart");
    expect(script).toContain("!selection.isCollapsed");
    expect(script).toContain("mark[data-lib-annotation]");
    expect(script).toContain("reader-press");
  });

  it("builds bounded scroll restoration scripts", () => {
    expect(readerChromeScrollScript(144.5)).toContain(
      "window.scrollTo(0, 144.5)",
    );
    expect(readerChromeScrollScript(-20)).toContain("window.scrollTo(0, 0)");
    expect(readerChromeScrollScript(Number.NaN)).toContain(
      "window.scrollTo(0, 0)",
    );
  });
});
