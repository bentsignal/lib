import type {
  MobileConvexStorage,
  MobileConvexTransaction,
  StoredDocument,
} from "./types";
import { cloneValue } from "./serialization";

export class MemoryMobileConvexStorage implements MobileConvexStorage {
  private documents = new Map<string, StoredDocument>();

  initialize() {
    return Promise.resolve();
  }

  async transaction<T>(
    mode: "read" | "write",
    run: (transaction: MobileConvexTransaction) => Promise<T>,
  ) {
    const working = cloneDocuments(this.documents);
    const result = await run(new MemoryTransaction(working));
    if (mode === "write") this.documents = working;
    return result;
  }
}

class MemoryTransaction implements MobileConvexTransaction {
  constructor(private readonly documents: Map<string, StoredDocument>) {}

  delete(id: string) {
    this.documents.delete(id);
    return Promise.resolve();
  }

  get(id: string) {
    const document = this.documents.get(id);
    return Promise.resolve(document ? cloneDocument(document) : null);
  }

  insert(_tableName: string, document: StoredDocument) {
    if (this.documents.has(document._id)) {
      throw new Error(`Document "${document._id}" already exists`);
    }
    this.documents.set(document._id, cloneDocument(document));
    return Promise.resolve();
  }

  scan(tableName: string) {
    return Promise.resolve(
      [...this.documents.values()]
        .filter(({ _id }) => _id.startsWith(`${tableName}:`))
        .map(cloneDocument),
    );
  }

  replace(id: string, document: StoredDocument) {
    if (!this.documents.has(id)) {
      throw new Error(`Document "${id}" does not exist`);
    }
    this.documents.set(id, cloneDocument(document));
    return Promise.resolve();
  }
}

function cloneDocuments(documents: Map<string, StoredDocument>) {
  return new Map(
    [...documents].map(([id, document]) => [id, cloneDocument(document)]),
  );
}

function cloneDocument(document: StoredDocument) {
  return cloneValue(document);
}
