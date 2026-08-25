import { and, asc, eq, gt, lt } from "drizzle-orm";

import { db } from "./database";
import { readerAnnotations } from "./schema";

export type ReaderAnnotation = typeof readerAnnotations.$inferSelect;
export type NewReaderAnnotation = Omit<
  typeof readerAnnotations.$inferInsert,
  "createdAt" | "updatedAt"
>;

export function readerAnnotationsQuery(bookId: string) {
  return db
    .select()
    .from(readerAnnotations)
    .where(eq(readerAnnotations.bookId, bookId))
    .orderBy(asc(readerAnnotations.createdAt));
}

export function addReaderAnnotation(annotation: NewReaderAnnotation) {
  const existing = db
    .select({ id: readerAnnotations.id })
    .from(readerAnnotations)
    .where(
      and(
        eq(readerAnnotations.bookId, annotation.bookId),
        eq(readerAnnotations.sectionId, annotation.sectionId),
        eq(readerAnnotations.startOffset, annotation.startOffset),
        eq(readerAnnotations.endOffset, annotation.endOffset),
        eq(readerAnnotations.kind, annotation.kind),
      ),
    )
    .get();
  if (existing) return existing.id;
  const timestamp = new Date().toISOString();
  db.insert(readerAnnotations)
    .values({ ...annotation, createdAt: timestamp, updatedAt: timestamp })
    .run();
  return annotation.id;
}

export function addChapterNote({
  bookId,
  id,
  note,
  sectionId,
}: {
  bookId: string;
  id: string;
  note: string;
  sectionId: string;
}) {
  const timestamp = new Date().toISOString();
  db.insert(readerAnnotations)
    .values({
      bookId,
      createdAt: timestamp,
      endOffset: 0,
      id,
      kind: "chapter-note",
      note,
      sectionId,
      selectedText: "",
      startOffset: 0,
      updatedAt: timestamp,
    })
    .run();
  return id;
}

export function deleteReaderAnnotation(id: string) {
  db.delete(readerAnnotations).where(eq(readerAnnotations.id, id)).run();
}

export function deleteReaderHighlightsInRange({
  bookId,
  endOffset,
  sectionId,
  startOffset,
}: {
  bookId: string;
  endOffset: number;
  sectionId: string;
  startOffset: number;
}) {
  db.delete(readerAnnotations)
    .where(
      and(
        eq(readerAnnotations.bookId, bookId),
        eq(readerAnnotations.sectionId, sectionId),
        eq(readerAnnotations.kind, "highlight"),
        lt(readerAnnotations.startOffset, endOffset),
        gt(readerAnnotations.endOffset, startOffset),
      ),
    )
    .run();
}

export function removeDuplicateReaderAnnotations(bookId: string) {
  const annotations = db
    .select()
    .from(readerAnnotations)
    .where(eq(readerAnnotations.bookId, bookId))
    .orderBy(asc(readerAnnotations.createdAt))
    .all();
  const seen = new Set<string>();
  for (const annotation of annotations) {
    if (annotation.kind === "chapter-note") continue;
    const key = [
      annotation.sectionId,
      annotation.startOffset,
      annotation.endOffset,
      annotation.kind,
    ].join(":");
    if (seen.has(key)) deleteReaderAnnotation(annotation.id);
    else seen.add(key);
  }
}

export function updateReaderAnnotationNote(id: string, note: string) {
  db.update(readerAnnotations)
    .set({ note, updatedAt: new Date().toISOString() })
    .where(eq(readerAnnotations.id, id))
    .run();
}
