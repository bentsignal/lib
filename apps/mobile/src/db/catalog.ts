import { asc, desc, eq } from "drizzle-orm";

import type { BookRecord, EpubLocation } from "@lib/ebook-core";

import { api } from "~/backend/api";
import { mobileConvex } from "~/backend/client";
import { db } from "./database";
import {
  importBooks,
  importSections,
  libraryBooks,
  librarySections,
  readerAnnotations,
  readingProgress,
} from "./schema";

export type BookScope = "import" | "library";
export type ReadingProgress = typeof readingProgress.$inferSelect;
export type {
  NewReaderAnnotation,
  ReaderAnnotation,
} from "./reader-annotations";
export {
  addChapterNote,
  addReaderAnnotation,
  deleteReaderAnnotation,
  deleteReaderHighlightsInRange,
  readerAnnotationsQuery,
  removeDuplicateReaderAnnotations,
  updateReaderAnnotationNote,
} from "./reader-annotations";

export async function insertBook(book: BookRecord, scope: BookScope) {
  await mobileConvex.mutation(api.books.insert, { book, scope });
}

export async function updateStoredBook(
  book: BookRecord,
  update: Partial<BookRecord>,
  scope: BookScope,
) {
  const next = {
    ...book,
    ...update,
    modifiedAt: new Date().toISOString(),
  };
  await mobileConvex.mutation(api.books.replace, { book: next, scope });
}

export async function removeStoredBook(id: string, scope: BookScope) {
  await mobileConvex.mutation(api.books.remove, { bookId: id, scope });
  if (scope === "library") {
    await db.transaction(async (transaction) => {
      await transaction
        .delete(readingProgress)
        .where(eq(readingProgress.bookId, id));
      await transaction
        .delete(readerAnnotations)
        .where(eq(readerAnnotations.bookId, id));
    });
  }
}

export async function promoteStoredBooks(books: BookRecord[]) {
  await mobileConvex.mutation(api.books.promote, { books });
}

// eslint-disable-next-line complexity -- A partial progress update preserves each format's independent position fields.
export function saveReadingProgress(
  bookId: string,
  update: Partial<
    Pick<
      ReadingProgress,
      "pdfPage" | "scrollProgress" | "sectionId" | "sectionIndex"
    >
  >,
) {
  const current = db
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.bookId, bookId))
    .get();
  const value = {
    bookId,
    pdfPage: update.pdfPage ?? current?.pdfPage,
    scrollProgress: update.scrollProgress ?? current?.scrollProgress ?? 0,
    sectionId: update.sectionId ?? current?.sectionId,
    sectionIndex: update.sectionIndex ?? current?.sectionIndex ?? 0,
    updatedAt: new Date().toISOString(),
  };
  db.insert(readingProgress)
    .values(value)
    .onConflictDoUpdate({ target: readingProgress.bookId, set: value })
    .run();
}

export function getReadingProgress(bookId: string) {
  return db
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.bookId, bookId))
    .get();
}

export function getReadingActivity() {
  return db
    .select({
      bookId: readingProgress.bookId,
      updatedAt: readingProgress.updatedAt,
    })
    .from(readingProgress)
    .all();
}

export function libraryQueries() {
  return {
    books: db
      .select()
      .from(libraryBooks)
      .orderBy(desc(libraryBooks.importedAt)),
    sections: db
      .select()
      .from(librarySections)
      .orderBy(asc(librarySections.bookId), asc(librarySections.position)),
  };
}

export function importQueries() {
  return {
    books: db.select().from(importBooks).orderBy(asc(importBooks.importedAt)),
    sections: db
      .select()
      .from(importSections)
      .orderBy(asc(importSections.bookId), asc(importSections.position)),
  };
}

export function readLegacyCatalog() {
  const library = libraryQueries();
  const imports = importQueries();
  return {
    imports: hydrateBooks(imports.books.all(), imports.sections.all()),
    library: hydrateBooks(library.books.all(), library.sections.all()),
  };
}

export function hydrateBooks(
  bookRows: (typeof libraryBooks.$inferSelect)[],
  sectionRows: (typeof librarySections.$inferSelect)[],
) {
  return bookRows.map((row) => ({
    author: row.author ?? undefined,
    convertedEpubUri: row.convertedEpubUri ?? undefined,
    coverFileName: row.coverFileName ?? undefined,
    epubLocations: parseLocations(row.epubLocations),
    epubStructureVersion: row.epubStructureVersion ?? undefined,
    exportedUri: row.exportedUri ?? undefined,
    fileSize: row.fileSize ?? undefined,
    format: row.format,
    id: row.id,
    importedAt: row.importedAt,
    modifiedAt: row.modifiedAt,
    pageCount: row.pageCount ?? undefined,
    sections: toSections(sectionRows.filter((item) => item.bookId === row.id)),
    sourceFileName: row.sourceFileName,
    title: row.title,
  })) satisfies BookRecord[];
}

function toSections(rows: (typeof librarySections.$inferSelect)[]) {
  return rows.map((row) => ({
    endLocation: row.endLocation ?? undefined,
    endPage: row.endPage ?? undefined,
    href: row.href ?? undefined,
    id: row.id,
    included: row.included,
    startLocation: row.startLocation ?? undefined,
    startPage: row.startPage ?? undefined,
    title: row.title,
  }));
}

function parseLocations(value: string | null) {
  if (!value) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse has an any return type; every retained item is validated below.
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(isEpubLocation)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function isEpubLocation(value: unknown): value is EpubLocation {
  if (!value || typeof value !== "object") return false;
  return (
    "href" in value &&
    typeof value.href === "string" &&
    "index" in value &&
    typeof value.index === "number" &&
    "title" in value &&
    typeof value.title === "string" &&
    "excerpt" in value &&
    typeof value.excerpt === "string"
  );
}
