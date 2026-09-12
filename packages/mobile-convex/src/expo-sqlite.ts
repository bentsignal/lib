import type { SQLiteDatabase } from "expo-sqlite";

import type {
  MobileConvexStorage,
  MobileConvexTransaction,
  StoredDocument,
} from "./types";
import { decodeValue, encodeValue } from "./serialization";

interface DocumentRow {
  document: string;
  id: string;
}

export function createExpoSQLiteStorage(
  database: SQLiteDatabase,
): MobileConvexStorage {
  return new ExpoSQLiteStorage(database);
}

class ExpoSQLiteStorage implements MobileConvexStorage {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize() {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS __mobile_convex_documents (
        id TEXT PRIMARY KEY NOT NULL,
        table_name TEXT NOT NULL,
        creation_time REAL NOT NULL,
        document TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS __mobile_convex_documents_by_table
        ON __mobile_convex_documents (table_name, creation_time, id);
    `);
  }

  async transaction<T>(
    _mode: "read" | "write",
    run: (transaction: MobileConvexTransaction) => Promise<T>,
  ) {
    let result: T | undefined;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      result = await run(new ExpoSQLiteTransaction(transaction));
    });
    return result as T;
  }
}

class ExpoSQLiteTransaction implements MobileConvexTransaction {
  constructor(private readonly database: SQLiteDatabase) {}

  async delete(id: string) {
    await this.database.runAsync(
      "DELETE FROM __mobile_convex_documents WHERE id = ?",
      id,
    );
  }

  async get(id: string) {
    const row = await this.database.getFirstAsync<DocumentRow>(
      "SELECT id, document FROM __mobile_convex_documents WHERE id = ?",
      id,
    );
    return row ? decodeDocument(row.document) : null;
  }

  async insert(tableName: string, document: StoredDocument) {
    await this.database.runAsync(
      `INSERT INTO __mobile_convex_documents
        (id, table_name, creation_time, document)
        VALUES (?, ?, ?, ?)`,
      document._id,
      tableName,
      document._creationTime,
      encodeValue(document),
    );
  }

  async scan(tableName: string) {
    const rows = await this.database.getAllAsync<DocumentRow>(
      `SELECT id, document FROM __mobile_convex_documents
        WHERE table_name = ? ORDER BY creation_time, id`,
      tableName,
    );
    return rows.map(({ document }) => decodeDocument(document));
  }

  async replace(id: string, document: StoredDocument) {
    const result = await this.database.runAsync(
      `UPDATE __mobile_convex_documents
        SET document = ? WHERE id = ?`,
      encodeValue(document),
      id,
    );
    if (result.changes === 0) {
      throw new Error(`Document "${id}" does not exist`);
    }
  }
}

function decodeDocument(value: string) {
  return decodeValue(value) as StoredDocument;
}
