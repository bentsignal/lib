import type { GenericDocument } from "convex/server";

export interface StoredDocument extends GenericDocument {
  _creationTime: number;
  _id: string;
}

export interface MobileConvexTransaction {
  delete(id: string): Promise<void>;
  get(id: string): Promise<StoredDocument | null>;
  insert(tableName: string, document: StoredDocument): Promise<void>;
  scan(tableName: string): Promise<StoredDocument[]>;
  replace(id: string, document: StoredDocument): Promise<void>;
}

export interface MobileConvexStorage {
  initialize(): Promise<void>;
  transaction<T>(
    mode: "read" | "write",
    run: (transaction: MobileConvexTransaction) => Promise<T>,
  ): Promise<T>;
}
