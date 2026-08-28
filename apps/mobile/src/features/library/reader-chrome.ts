export interface ReaderChromePressMessage {
  type: "reader-press";
}

export function readerChromePressScript() {
  return `(function () {
    if (window.__libReaderChromeListener) return;
    var maximumTapMovement = 12;
    function selectionIsActive() {
      var selection = window.getSelection();
      return Boolean(selection && !selection.isCollapsed);
    }
    function interactiveTarget(target) {
      return target && target.closest
        ? target.closest('a, button, input, select, textarea, [role="button"], mark[data-lib-annotation]')
        : null;
    }
    function rememberPress(point, target) {
      window.__libReaderChromePress = {
        interactive: Boolean(interactiveTarget(target)),
        selection: selectionIsActive(),
        x: point.clientX,
        y: point.clientY
      };
    }
    function finishPress(point, target) {
      var press = window.__libReaderChromePress;
      window.__libReaderChromePress = null;
      if (!press) return;
      if (Math.abs(point.clientX - press.x) > maximumTapMovement) return;
      if (Math.abs(point.clientY - press.y) > maximumTapMovement) return;
      if (press.interactive || interactiveTarget(target)) return;
      if (press.selection || selectionIsActive()) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'reader-press' }));
    }
    window.addEventListener('touchstart', function (event) {
      var touch = event.touches[0];
      if (touch) rememberPress(touch, event.target);
    }, { capture: true, passive: true });
    window.addEventListener('touchend', function (event) {
      var touch = event.changedTouches[0];
      if (touch) finishPress(touch, event.target);
      window.__libReaderChromeLastTouchEnd = Date.now();
    }, { capture: true, passive: true });
    window.addEventListener('touchcancel', function () {
      window.__libReaderChromePress = null;
    }, { capture: true, passive: true });
    window.addEventListener('mousedown', function (event) {
      if (Date.now() - (window.__libReaderChromeLastTouchEnd || 0) < 750) return;
      rememberPress(event, event.target);
    }, true);
    window.addEventListener('mouseup', function (event) {
      finishPress(event, event.target);
    }, true);
    window.__libReaderChromeListener = true;
  })(); true;`;
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
