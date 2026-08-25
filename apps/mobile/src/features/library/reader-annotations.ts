import type { ReaderAnnotation } from "~/db/catalog";

export interface ReaderSelectionMessage {
  action: "chatgpt" | "highlight" | "note" | "unhighlight";
  endOffset: number;
  selectedText: string;
  startOffset: number;
  type: "selection";
}

export interface ReaderAnnotationMessage {
  id: string;
  type: "annotation-press";
}

export interface ReaderSelectionStateMessage {
  hasHighlight: boolean;
  type: "selection-state";
}

export type ReaderAnnotationEvent =
  | ReaderAnnotationMessage
  | ReaderSelectionMessage
  | ReaderSelectionStateMessage;

export function readerSelectionObserverScript() {
  return `(function () {
    if (window.__libSelectionObserver) return;
    function publishSelectionState() {
      window.clearTimeout(window.__libSelectionTimer);
      window.__libSelectionTimer = window.setTimeout(function () {
        var root = document.getElementById('lib-reader-content');
        var selection = window.getSelection();
        var hasHighlight = false;
        if (root && selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          var range = selection.getRangeAt(0);
          if (root.contains(range.commonAncestorContainer)) {
            Array.prototype.some.call(root.querySelectorAll('mark[data-lib-kind="highlight"]'), function (mark) {
              if (!range.intersectsNode(mark)) return false;
              hasHighlight = true;
              return true;
            });
          }
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          hasHighlight: hasHighlight,
          type: 'selection-state'
        }));
      }, 0);
    }
    document.addEventListener('selectionchange', publishSelectionState);
    window.__libSelectionObserver = true;
  })(); true;`;
}

export function readerSelectionScript(
  action: "chatgpt" | "highlight" | "note" | "unhighlight",
) {
  return `(function () {
    var root = document.getElementById('lib-reader-content');
    var selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    var range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    var prefix = document.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    var startOffset = prefix.toString().length;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      action: '${action}',
      endOffset: startOffset + range.toString().length,
      selectedText: range.toString(),
      startOffset: startOffset,
      type: 'selection'
    }));
  })(); true;`;
}

export function applyReaderAnnotationsScript(
  annotations: ReaderAnnotation[],
  scrollToId?: string,
) {
  const values = annotations
    .filter((annotation) => annotation.kind !== "chapter-note")
    .map((annotation) => ({
      endOffset: annotation.endOffset,
      id: annotation.id,
      kind: annotation.kind,
      startOffset: annotation.startOffset,
    }));
  return `(function () {
    var root = document.getElementById('lib-reader-content');
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('mark[data-lib-annotation]'), function (mark) {
      mark.replaceWith(document.createTextNode(mark.textContent || ''));
    });
    root.normalize();

    function textNodes() {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var nodes = [];
      var node;
      while ((node = walker.nextNode())) nodes.push(node);
      return nodes;
    }

    function apply(annotation) {
      var nodes = textNodes();
      var cursor = 0;
      nodes.forEach(function (node) {
        var length = node.nodeValue ? node.nodeValue.length : 0;
        var nodeStart = cursor;
        var nodeEnd = cursor + length;
        cursor = nodeEnd;
        if (annotation.endOffset <= nodeStart || annotation.startOffset >= nodeEnd) return;
        var start = Math.max(0, annotation.startOffset - nodeStart);
        var end = Math.min(length, annotation.endOffset - nodeStart);
        if (start >= end) return;
        var range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        var mark = document.createElement('mark');
        mark.dataset.libAnnotation = annotation.id;
        mark.dataset.libKind = annotation.kind;
        range.surroundContents(mark);
      });
    }

    ${JSON.stringify(values)}
      .slice()
      .sort(function (left, right) { return right.startOffset - left.startOffset; })
      .forEach(apply);

    if (!window.__libAnnotationListener) {
      root.addEventListener('click', function (event) {
        var target = event.target && event.target.closest
          ? event.target.closest('mark[data-lib-annotation]')
          : null;
        if (!target) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id: target.dataset.libAnnotation,
          type: 'annotation-press'
        }));
      });
      window.__libAnnotationListener = true;
    }
    var requested = ${JSON.stringify(scrollToId)};
    if (requested) {
      var target = root.querySelector('mark[data-lib-annotation="' + requested + '"]');
      if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  })(); true;`;
}

export function scrollToReaderSearchResultScript({
  locationIndex,
  occurrence,
  query,
}: {
  locationIndex: number;
  occurrence: number;
  query: string;
}) {
  const normalizedQuery = query
    .trim()
    .replaceAll(/[\s\u0085]+/gu, " ")
    .toLocaleLowerCase();
  return `(function () {
    var location = document.querySelector('[data-lib-location="${locationIndex}"]');
    var needle = ${JSON.stringify(normalizedQuery)};
    if (!location || !needle) return;
    var walker = document.createTreeWalker(location, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var text = '';
    var node;
    while ((node = walker.nextNode())) {
      var value = node.nodeValue || '';
      nodes.push({ end: text.length + value.length, node: node, start: text.length });
      text += value;
    }
    var haystack = '';
    var positions = [];
    var source = text.toLocaleLowerCase();
    for (var sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
      var character = source[sourceIndex];
      if (/\\s|\\u0085/u.test(character)) {
        if (haystack && haystack[haystack.length - 1] !== ' ') {
          haystack += ' ';
          positions.push(sourceIndex);
        }
      } else {
        haystack += character;
        positions.push(sourceIndex);
      }
    }
    var offset = 0;
    var match = -1;
    for (var index = 0; index <= ${occurrence}; index += 1) {
      match = haystack.indexOf(needle, offset);
      if (match < 0) return;
      offset = match + Math.max(needle.length, 1);
    }
    var sourceStart = positions[match];
    var sourceEnd = (positions[match + needle.length - 1] || sourceStart) + 1;
    var startNode = nodes.find(function (entry) { return sourceStart >= entry.start && sourceStart < entry.end; });
    var endNode = nodes.find(function (entry) { return sourceEnd > entry.start && sourceEnd <= entry.end; });
    if (!startNode || !endNode) {
      location.scrollIntoView({ block: 'center', behavior: 'instant' });
      return;
    }
    var range = document.createRange();
    range.setStart(startNode.node, sourceStart - startNode.start);
    range.setEnd(endNode.node, sourceEnd - endNode.start);
    var bounds = range.getBoundingClientRect();
    window.scrollTo({
      behavior: 'instant',
      top: window.scrollY + bounds.top - (window.innerHeight - bounds.height) / 2
    });
    var selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  })(); true;`;
}

// eslint-disable-next-line complexity -- Every WebView field is narrowed before crossing the native boundary.
export function parseReaderAnnotationEvent(value: string) {
  try {
    // eslint-disable-next-line no-restricted-syntax -- JSON must be narrowed from an untrusted WebView message before use.
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return undefined;
    }
    if (
      parsed.type === "annotation-press" &&
      "id" in parsed &&
      typeof parsed.id === "string"
    ) {
      return {
        id: parsed.id,
        type: "annotation-press",
      } satisfies ReaderAnnotationMessage;
    }
    if (
      parsed.type === "selection-state" &&
      "hasHighlight" in parsed &&
      typeof parsed.hasHighlight === "boolean"
    ) {
      return {
        hasHighlight: parsed.hasHighlight,
        type: "selection-state",
      } satisfies ReaderSelectionStateMessage;
    }
    if (
      parsed.type === "selection" &&
      "action" in parsed &&
      (parsed.action === "chatgpt" ||
        parsed.action === "highlight" ||
        parsed.action === "note" ||
        parsed.action === "unhighlight") &&
      "startOffset" in parsed &&
      typeof parsed.startOffset === "number" &&
      "endOffset" in parsed &&
      typeof parsed.endOffset === "number" &&
      "selectedText" in parsed &&
      typeof parsed.selectedText === "string"
    ) {
      return {
        action: parsed.action,
        endOffset: parsed.endOffset,
        selectedText: parsed.selectedText,
        startOffset: parsed.startOffset,
        type: "selection",
      } satisfies ReaderSelectionMessage;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
