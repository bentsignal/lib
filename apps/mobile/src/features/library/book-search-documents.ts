import { File } from "expo-file-system";
import { openDatabaseSync } from "expo-sqlite";

import type { BookRecord } from "@lib/ebook-core";
import {
  extractEpubLocationTexts,
  sectionLocationRange,
} from "@lib/ebook-core";

import type { BookSearchDocument } from "./book-search";
import type { BookScope } from "~/db/catalog";
import { extractPdfTextAsync } from "~/native/lib-pdf";
import { parseBookSearchDocuments } from "./book-search";
import { getSourceFile } from "./library-storage";

export function getBookSearchDocuments(
  book: BookRecord,
  scope: BookScope = "library",
) {
  const key = `${scope}:${book.id}:${book.modifiedAt}`;
  const cached = documentCache.get(key);
  if (cached) return cached;
  const documents = loadOrBuildBookSearchDocuments(book, scope).catch(
    (error: unknown) => {
      documentCache.delete(key);
      throw error;
    },
  );
  documentCache.set(key, documents);
  return documents;
}

export function scheduleBookSearchIndexes(
  books: BookRecord[],
  scope: BookScope = "library",
) {
  setTimeout(() => {
    for (const book of books) {
      indexQueue = indexQueue
        .then(() => idlePause())
        .then(() => getBookSearchDocuments(book, scope))
        .then(() => undefined)
        .catch(() => undefined);
    }
  }, 1200);
}

export async function removeBookSearchIndex(bookId: string, scope: BookScope) {
  for (const key of documentCache.keys()) {
    if (key.startsWith(`${scope}:${bookId}:`)) documentCache.delete(key);
  }
  await searchDatabase?.runAsync(
    "DELETE FROM book_search_indexes WHERE scope = ? AND book_id = ?",
    [scope, bookId],
  );
}

export function sectionForSearchPosition(book: BookRecord, position: number) {
  return book.sections.find((section) => {
    if (!section.included) return false;
    if (book.format === "pdf") {
      return (
        position >= (section.startPage ?? 1) &&
        position <= (section.endPage ?? book.pageCount ?? 1)
      );
    }
    const range = sectionLocationRange(section, book.epubLocations ?? []);
    return position - 1 >= range.start && position - 1 <= range.end;
  });
}

async function buildBookSearchDocuments(book: BookRecord, scope: BookScope) {
  if (book.format === "pdf") {
    const pages = await extractPdfTextAsync(getSourceFile(book, scope).uri);
    return pages
      .map((text, index) => ({ position: index + 1, text }))
      .filter((document) => sectionForSearchPosition(book, document.position));
  }
  const locations = book.epubLocations ?? [];
  const source = new File(getSourceFile(book, scope).uri);
  const texts = await extractEpubLocationTexts(await source.bytes(), locations);
  return texts
    .map((text, index) => ({ position: index + 1, text }))
    .filter((document) => sectionForSearchPosition(book, document.position));
}

async function loadOrBuildBookSearchDocuments(
  book: BookRecord,
  scope: BookScope,
) {
  const stored = await loadStoredSearchIndex(book, scope).catch(
    () => undefined,
  );
  const documents = stored?.documentsJson
    ? parseBookSearchDocuments(stored.documentsJson)
    : undefined;
  if (documents) return documents;
  const built = await buildBookSearchDocuments(book, scope);
  await storeSearchIndex(book, scope, built).catch(() => undefined);
  return built;
}

async function loadStoredSearchIndex(book: BookRecord, scope: BookScope) {
  if (!searchDatabase) return undefined;
  return searchDatabase.getFirstAsync<StoredSearchIndex>(
    `SELECT documents_json AS documentsJson
     FROM book_search_indexes
     WHERE scope = ? AND book_id = ? AND source_modified_at = ?`,
    [scope, book.id, book.modifiedAt],
  );
}

async function storeSearchIndex(
  book: BookRecord,
  scope: BookScope,
  documents: BookSearchDocument[],
) {
  if (!searchDatabase) return;
  await searchDatabase.runAsync(
    `INSERT INTO book_search_indexes (
       scope, book_id, source_modified_at, documents_json, indexed_at
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(scope, book_id) DO UPDATE SET
       source_modified_at = excluded.source_modified_at,
       documents_json = excluded.documents_json,
       indexed_at = excluded.indexed_at`,
    [
      scope,
      book.id,
      book.modifiedAt,
      JSON.stringify(documents),
      new Date().toISOString(),
    ],
  );
}

function idlePause() {
  return new Promise<void>((resolve) => setTimeout(resolve, 100));
}

const documentCache = new Map<string, Promise<BookSearchDocument[]>>();
let indexQueue = Promise.resolve();

interface StoredSearchIndex {
  documentsJson: string;
}

const searchDatabase = openSearchDatabase();

function openSearchDatabase() {
  try {
    const database = openDatabaseSync("lib-search.db");
    database.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS book_search_indexes (
        scope TEXT NOT NULL,
        book_id TEXT NOT NULL,
        source_modified_at TEXT NOT NULL,
        documents_json TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        PRIMARY KEY (scope, book_id)
      );
    `);
    return database;
  } catch {
    return undefined;
  }
}
