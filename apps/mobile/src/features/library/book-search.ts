export interface BookSearchDocument {
  position: number;
  text: string;
}

export interface BookSearchMatch {
  position: number;
}

export interface BookSearchResult extends BookSearchMatch {
  occurrence: number;
  snippet: string;
}

export function parseBookSearchDocuments(value: string) {
  try {
    // eslint-disable-next-line no-restricted-syntax -- Persisted JSON is narrowed before it can become a search document.
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(isSearchDocument)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export function findBookTextMatches(
  documents: BookSearchDocument[],
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return new Array<BookSearchMatch>();

  const matches = new Array<BookSearchMatch>();
  for (const document of documents) {
    const text = document.text.toLocaleLowerCase();
    let offset = 0;
    while (offset < text.length) {
      const match = text.indexOf(needle, offset);
      if (match < 0) break;
      matches.push({ position: document.position });
      offset = match + Math.max(needle.length, 1);
    }
  }
  return matches;
}

export function findBookTextResults(
  documents: BookSearchDocument[],
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return new Array<BookSearchResult>();

  const results = new Array<BookSearchResult>();
  for (const document of documents) {
    const text = document.text.toLocaleLowerCase();
    let offset = 0;
    let occurrence = 0;
    while (offset < text.length) {
      const match = text.indexOf(needle, offset);
      if (match < 0) break;
      results.push({
        occurrence,
        position: document.position,
        snippet: resultSnippet(document.text, match, needle.length),
      });
      occurrence += 1;
      offset = match + Math.max(needle.length, 1);
    }
  }
  return results;
}

export function nextMatchIndex(
  matches: BookSearchMatch[],
  currentIndex: number,
  currentPosition: number,
  direction: -1 | 1,
) {
  if (matches.length === 0) return -1;
  if (currentIndex >= 0) {
    return (currentIndex + direction + matches.length) % matches.length;
  }
  if (direction === 1) {
    const next = matches.findIndex(
      (match) => match.position >= currentPosition,
    );
    return next < 0 ? 0 : next;
  }
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    if ((matches[index]?.position ?? 0) <= currentPosition) return index;
  }
  return matches.length - 1;
}

function resultSnippet(text: string, start: number, length: number) {
  const context = 72;
  const first = Math.max(0, start - context);
  const last = Math.min(text.length, start + length + context);
  const prefix = first > 0 ? "…" : "";
  const suffix = last < text.length ? "…" : "";
  return `${prefix}${text.slice(first, last).trim()}${suffix}`;
}

function isSearchDocument(value: unknown): value is BookSearchDocument {
  return (
    !!value &&
    typeof value === "object" &&
    "position" in value &&
    typeof value.position === "number" &&
    "text" in value &&
    typeof value.text === "string"
  );
}
