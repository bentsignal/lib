export interface ReaderChromePressMessage {
  type: "reader-press";
}

export function readerChromePressScript() {
  return `(function () {
    if (window.__libReaderChromeListener) return;
    function selectionIsActive() {
      var selection = window.getSelection();
      return Boolean(selection && !selection.isCollapsed);
    }
    function rememberSelection() {
      window.__libReaderChromeSelectionAtPressStart = selectionIsActive();
    }
    document.addEventListener('touchstart', rememberSelection, { passive: true });
    document.addEventListener('mousedown', rememberSelection);
    document.addEventListener('click', function (event) {
      var selectionAtPressStart = window.__libReaderChromeSelectionAtPressStart;
      window.__libReaderChromeSelectionAtPressStart = false;
      if (event.defaultPrevented) return;
      var target = event.target;
      var interactive = target && target.closest
        ? target.closest('a, button, input, select, textarea, [role="button"], mark[data-lib-annotation]')
        : null;
      if (interactive) return;
      if (selectionAtPressStart || selectionIsActive()) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'reader-press' }));
    });
    window.__libReaderChromeListener = true;
  })(); true;`;
}

export function readerChromeScrollScript(offset: number) {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
  return `window.scrollTo(0, ${safeOffset}); true;`;
}

export function parseReaderChromeEvent(value: string) {
  try {
    // eslint-disable-next-line no-restricted-syntax -- JSON must be narrowed from an untrusted WebView message before use.
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "type" in parsed &&
      parsed.type === "reader-press"
    ) {
      return { type: "reader-press" };
    }
  } catch {
    return undefined;
  }
  return undefined;
}
