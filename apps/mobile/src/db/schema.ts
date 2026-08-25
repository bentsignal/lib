import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

function bookColumns() {
  return {
    author: text(),
    convertedEpubUri: text("converted_epub_uri"),
    coverFileName: text("cover_file_name"),
    epubStructureVersion: integer("epub_structure_version"),
    epubLocations: text("epub_locations"),
    exportedUri: text("exported_uri"),
    fileSize: integer("file_size"),
    format: text({ enum: ["epub", "pdf"] }).notNull(),
    id: text().primaryKey(),
    importedAt: text("imported_at").notNull(),
    modifiedAt: text("modified_at").notNull(),
    pageCount: integer("page_count"),
    sourceFileName: text("source_file_name").notNull(),
    title: text().notNull(),
  };
}

export const libraryBooks = sqliteTable("library_books", bookColumns());
export const importBooks = sqliteTable("import_books", bookColumns());

function sectionColumns() {
  return {
    bookId: text("book_id").notNull(),
    endLocation: integer("end_location"),
    endPage: integer("end_page"),
    href: text(),
    id: text().notNull(),
    included: integer({ mode: "boolean" }).notNull(),
    position: integer().notNull(),
    startLocation: integer("start_location"),
    startPage: integer("start_page"),
    title: text().notNull(),
  };
}

export const librarySections = sqliteTable(
  "library_sections",
  sectionColumns(),
  (table) => [primaryKey({ columns: [table.bookId, table.id] })],
);
export const importSections = sqliteTable(
  "import_sections",
  sectionColumns(),
  (table) => [primaryKey({ columns: [table.bookId, table.id] })],
);

export const readingProgress = sqliteTable("reading_progress", {
  bookId: text("book_id").primaryKey(),
  pdfPage: integer("pdf_page"),
  scrollProgress: real("scroll_progress").notNull().default(0),
  sectionId: text("section_id"),
  sectionIndex: integer("section_index").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const readerAnnotations = sqliteTable(
  "reader_annotations",
  {
    bookId: text("book_id").notNull(),
    createdAt: text("created_at").notNull(),
    endOffset: integer("end_offset").notNull(),
    id: text().primaryKey(),
    kind: text({ enum: ["chapter-note", "highlight", "note"] }).notNull(),
    note: text(),
    sectionId: text("section_id").notNull(),
    selectedText: text("selected_text").notNull(),
    startOffset: integer("start_offset").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("reader_annotations_book_id_idx").on(table.bookId)],
);
