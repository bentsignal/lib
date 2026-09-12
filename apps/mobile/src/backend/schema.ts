import type { DataModelFromSchemaDefinition } from "@lib/mobile-convex/server";
import { defineSchema, defineTable } from "@lib/mobile-convex/server";
import { v } from "@lib/mobile-convex/values";

export const bookScopeValidator = v.union(
  v.literal("import"),
  v.literal("library"),
);

const epubLocationValidator = v.object({
  endOffset: v.optional(v.number()),
  excerpt: v.string(),
  fragment: v.optional(v.string()),
  href: v.string(),
  index: v.number(),
  startOffset: v.optional(v.number()),
  title: v.string(),
});

const bookSectionValidator = v.object({
  endLocation: v.optional(v.number()),
  endPage: v.optional(v.number()),
  href: v.optional(v.string()),
  id: v.string(),
  included: v.boolean(),
  startLocation: v.optional(v.number()),
  startPage: v.optional(v.number()),
  title: v.string(),
});

export const bookRecordValidator = v.object({
  author: v.optional(v.string()),
  convertedEpubUri: v.optional(v.string()),
  coverFileName: v.optional(v.string()),
  epubLocations: v.optional(v.array(epubLocationValidator)),
  epubStructureVersion: v.optional(v.number()),
  exportedUri: v.optional(v.string()),
  fileSize: v.optional(v.number()),
  format: v.union(v.literal("epub"), v.literal("pdf")),
  id: v.string(),
  importedAt: v.string(),
  modifiedAt: v.string(),
  pageCount: v.optional(v.number()),
  sections: v.array(bookSectionValidator),
  sourceFileName: v.string(),
  title: v.string(),
});

export const schema = defineSchema({
  books: defineTable({
    book: bookRecordValidator,
    scope: bookScopeValidator,
  })
    .index("by_book_id", ["book.id"])
    .index("by_scope_and_imported_at", ["scope", "book.importedAt"]),
  migrations: defineTable({
    completedAt: v.string(),
    key: v.string(),
  }).index("by_key", ["key"]),
});

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
