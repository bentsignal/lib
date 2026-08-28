import { describe, expect, it } from "vitest";

import {
  parseReaderChromeEvent,
  readerChromePressScript,
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
    expect(script).toContain("touchend");
    expect(script).toContain("capture: true");
    expect(script).toContain("maximumTapMovement");
    expect(script).toContain("__libReaderChromeLastTouchEnd");
    expect(script).toContain("press.selection");
    expect(script).toContain("!selection.isCollapsed");
    expect(script).toContain("mark[data-lib-annotation]");
    expect(script).toContain("reader-press");
    expect(script).not.toContain("addEventListener('click'");
  });
});
