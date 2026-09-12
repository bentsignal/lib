import type { GenericDatabaseWriter } from "@lib/mobile-convex/server";
import { v } from "@lib/mobile-convex/values";

import type { DataModel } from "./schema";
import { bookRecordValidator, bookScopeValidator } from "./schema";
import { mutation, query } from "./server";

export const list = query({
  args: { scope: bookScopeValidator },
  returns: v.array(bookRecordValidator),
  handler: async (context, { scope }) => {
    const documents = await context.db
      .query("books")
      .withIndex("by_scope_and_imported_at", (range) =>
        range.eq("scope", scope),
      )
      .order(scope === "library" ? "desc" : "asc")
      .collect();
    return documents.map(({ book }) => book);
  },
});

export const insert = mutation({
  args: { book: bookRecordValidator, scope: bookScopeValidator },
  returns: v.id("books"),
  handler: async (context, { book, scope }) => {
    await assertBookIsNew(context, book.id);
    return context.db.insert("books", { book, scope });
  },
});

export const replace = mutation({
  args: { book: bookRecordValidator, scope: bookScopeValidator },
  returns: v.null(),
  handler: async (context, { book, scope }) => {
    const stored = await findBook(context, book.id, scope);
    if (!stored) throw new Error(`Book "${book.id}" does not exist`);
    await context.db.patch(stored._id, { book });
    return null;
  },
});

export const remove = mutation({
  args: { bookId: v.string(), scope: bookScopeValidator },
  returns: v.null(),
  handler: async (context, { bookId, scope }) => {
    const stored = await findBook(context, bookId, scope);
    if (stored) await context.db.delete(stored._id);
    return null;
  },
});

export const promote = mutation({
  args: { books: v.array(bookRecordValidator) },
  returns: v.null(),
  handler: async (context, { books }) => {
    for (const book of books) {
      const imported = await findBook(context, book.id, "import");
      if (imported) await context.db.delete(imported._id);
      const libraryBook = await findBook(context, book.id, "library");
      if (libraryBook) await context.db.patch(libraryBook._id, { book });
      else await context.db.insert("books", { book, scope: "library" });
    }
    return null;
  },
});

export const migrateLegacyCatalog = mutation({
  args: {
    imports: v.array(bookRecordValidator),
    library: v.array(bookRecordValidator),
  },
  returns: v.boolean(),
  handler: async (context, legacy) => {
    const completed = await context.db
      .query("migrations")
      .withIndex("by_key", (range) => range.eq("key", "legacy-catalog-v1"))
      .unique();
    if (completed) return false;
    for (const book of legacy.library) {
      await context.db.insert("books", { book, scope: "library" });
    }
    for (const book of legacy.imports) {
      await context.db.insert("books", { book, scope: "import" });
    }
    await context.db.insert("migrations", {
      completedAt: new Date().toISOString(),
      key: "legacy-catalog-v1",
    });
    return true;
  },
});

async function findBook(
  context: { db: DataModelWriter },
  bookId: string,
  scope: "import" | "library",
) {
  const matches = await context.db
    .query("books")
    .withIndex("by_book_id", (range) => range.eq("book.id", bookId))
    .collect();
  return matches.find((document) => document.scope === scope) ?? null;
}

async function assertBookIsNew(
  context: { db: DataModelWriter },
  bookId: string,
) {
  const existing = await context.db
    .query("books")
    .withIndex("by_book_id", (range) => range.eq("book.id", bookId))
    .first();
  if (existing) throw new Error(`Book "${bookId}" already exists`);
}

type DataModelWriter = GenericDatabaseWriter<DataModel>;
