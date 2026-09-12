import type {
  GenericDocument,
  GenericSchema,
  SchemaDefinition,
} from "convex/server";

import type { MobileConvexTransaction, StoredDocument } from "./types";
import { MobileQuery } from "./query";
import { cloneValue } from "./serialization";
import { validateWithValidator } from "./validation";

export class MobileDatabaseReader {
  constructor(
    protected readonly transaction: MobileConvexTransaction,
    protected readonly schema: SchemaDefinition<GenericSchema, boolean>,
  ) {}

  async get(...arguments_: [string] | [string, string]) {
    const [tableName, id] =
      arguments_.length === 1
        ? [tableFromId(arguments_[0]), arguments_[0]]
        : arguments_;
    assertIdTable(tableName, id);
    const document = await this.transaction.get(id);
    return document ? cloneDocument(document) : null;
  }

  normalizeId(tableName: string, id: string) {
    return id.startsWith(`${tableName}:`) ? id : null;
  }

  query(tableName: string) {
    tableDefinition(this.schema, tableName);
    const query = new MobileQuery(() => this.transaction.scan(tableName));
    return {
      ...query,
      filter: query.filter.bind(query),
      collect: query.collect.bind(query),
      first: query.first.bind(query),
      order: query.order.bind(query),
      take: query.take.bind(query),
      unique: query.unique.bind(query),
      withIndex: (indexName: string, build?: (builder: unknown) => unknown) => {
        const fields = indexFields(this.schema, tableName, indexName);
        return query.withIndex(indexName, fields, build);
      },
      withSearchIndex: () => {
        throw new Error(
          "Search indexes are not supported by mobile-convex yet",
        );
      },
      fullTableScan: query,
    };
  }

  system = {
    get: () => Promise.resolve(null),
    normalizeId: () => null,
    query: () => {
      throw new Error("System tables are not supported by mobile-convex yet");
    },
  };
}

export class MobileDatabaseWriter extends MobileDatabaseReader {
  constructor(
    transaction: MobileConvexTransaction,
    schema: SchemaDefinition<GenericSchema, boolean>,
    private readonly createId: (tableName: string) => string,
    private readonly now: () => number,
  ) {
    super(transaction, schema);
  }

  async insert(tableName: string, value: GenericDocument) {
    validateDocument(this.schema, tableName, value);
    const id = this.createId(tableName);
    assertIdTable(tableName, id);
    await this.transaction.insert(tableName, {
      ...cloneValue(value),
      _creationTime: this.now(),
      _id: id,
    });
    return id;
  }

  async patch(
    ...arguments_: [string, GenericDocument] | [string, string, GenericDocument]
  ) {
    const [tableName, id, value] = writeArguments(arguments_);
    const current = await this.requiredDocument(tableName, id);
    const patch = cloneValue(value);
    const next = { ...current };
    for (const [key, item] of Object.entries(patch)) {
      next[key] = item;
    }
    const userDocument = withoutSystemFields(next);
    validateDocument(this.schema, tableName, userDocument);
    await this.transaction.replace(id, next);
  }

  async replace(
    ...arguments_: [string, GenericDocument] | [string, string, GenericDocument]
  ) {
    const [tableName, id, value] = writeArguments(arguments_);
    const current = await this.requiredDocument(tableName, id);
    validateDocument(this.schema, tableName, value);
    await this.transaction.replace(id, {
      ...cloneValue(value),
      _creationTime: current._creationTime,
      _id: current._id,
    });
  }

  async delete(...arguments_: [string] | [string, string]) {
    const [tableName, id] =
      arguments_.length === 1
        ? [tableFromId(arguments_[0]), arguments_[0]]
        : arguments_;
    assertIdTable(tableName, id);
    await this.transaction.delete(id);
  }

  private async requiredDocument(tableName: string, id: string) {
    assertIdTable(tableName, id);
    const document = await this.transaction.get(id);
    if (!document) throw new Error(`Document "${id}" does not exist`);
    return document;
  }
}

function tableDefinition(
  schema: SchemaDefinition<GenericSchema, boolean>,
  tableName: string,
) {
  const table = schema.tables[tableName];
  if (!table)
    throw new Error(`Table "${tableName}" is not in the mobile Convex schema`);
  return table;
}

function validateDocument(
  schema: SchemaDefinition<GenericSchema, boolean>,
  tableName: string,
  value: GenericDocument,
) {
  const table = tableDefinition(schema, tableName);
  if (!schema.schemaValidation) return;
  validateWithValidator(table.validator, value, `Document for "${tableName}"`);
}

function indexFields(
  schema: SchemaDefinition<GenericSchema, boolean>,
  tableName: string,
  indexName: string,
) {
  if (indexName === "by_creation_time") return ["_creationTime"];
  const table = tableDefinition(schema, tableName);
  const index = table[" indexes"]().find(
    ({ indexDescriptor }) => indexDescriptor === indexName,
  );
  if (!index) {
    throw new Error(`Index "${tableName}.${indexName}" is not in the schema`);
  }
  return index.fields;
}

function writeArguments(
  arguments_: [string, GenericDocument] | [string, string, GenericDocument],
): [string, string, GenericDocument] {
  if (arguments_.length === 2) {
    return [tableFromId(arguments_[0]), arguments_[0], arguments_[1]];
  }
  return arguments_;
}

function tableFromId(id: string) {
  const separator = id.indexOf(":");
  if (separator <= 0) throw new Error(`Invalid mobile Convex ID: "${id}"`);
  return id.slice(0, separator);
}

function assertIdTable(tableName: string, id: string) {
  if (!id.startsWith(`${tableName}:`)) {
    throw new Error(`ID "${id}" does not belong to table "${tableName}"`);
  }
}

function withoutSystemFields(document: StoredDocument) {
  const { _creationTime: _, _id: __, ...value } = document;
  return value;
}

function cloneDocument(document: StoredDocument) {
  return cloneValue(document);
}
