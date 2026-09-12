import type { GenericSchema, SchemaDefinition } from "convex/server";
import type { Value } from "convex/values";

import type {
  ExecutableRegisteredMutation,
  ExecutableRegisteredQuery,
} from "./server";
import type { MobileConvexStorage } from "./types";
import { MobileDatabaseReader, MobileDatabaseWriter } from "./database";
import { cloneValue, stableValueKey } from "./serialization";
import { validateExportedValidator } from "./validation";

type PublicQuery = Pick<
  ExecutableRegisteredQuery<never, unknown>,
  "_handler" | "exportArgs" | "exportReturns" | "isPublic" | "isQuery"
>;
type PublicMutation = Pick<
  ExecutableRegisteredMutation<never, unknown>,
  "_handler" | "exportArgs" | "exportReturns" | "isMutation" | "isPublic"
>;

export type FunctionArgs<Function> = Function extends {
  readonly __mobileArgs: infer Args;
}
  ? Args
  : never;

export type FunctionResult<Function> = Function extends {
  readonly __mobileReturns: infer Result;
}
  ? Awaited<Result>
  : never;

interface QueryRecord {
  arguments: Record<string, Value>;
  error?: unknown;
  function: PublicQuery;
  key: string;
  listeners: Set<() => void>;
  status: "loading" | "success" | "error";
  value?: unknown;
  version: number;
}

export interface MobileConvexClientOptions {
  createId?: (tableName: string) => string;
  now?: () => number;
  schema: SchemaDefinition<GenericSchema, boolean>;
  storage: MobileConvexStorage;
}

export class MobileConvexClient {
  private readonly createId: (tableName: string) => string;
  private readonly functionIds = new WeakMap<PublicQuery, number>();
  private initialization?: Promise<void>;
  private nextFunctionId = 1;
  private operation = Promise.resolve();
  private readonly now: () => number;
  private readonly queries = new Map<string, QueryRecord>();
  private readonly schema: SchemaDefinition<GenericSchema, boolean>;
  private readonly storage: MobileConvexStorage;

  constructor(options: MobileConvexClientOptions) {
    this.createId = options.createId ?? defaultCreateId;
    this.now = options.now ?? Date.now;
    this.schema = options.schema;
    this.storage = options.storage;
  }

  initialize() {
    this.initialization ??= this.storage.initialize();
    return this.initialization;
  }

  query<Function extends PublicQuery>(
    function_: Function,
    arguments_: FunctionArgs<Function> & Record<string, unknown>,
  ): Promise<FunctionResult<Function>> {
    return this.enqueue(() =>
      this.executeQuery(function_, arguments_),
    ) as Promise<FunctionResult<Function>>;
  }

  mutation<Function extends PublicMutation>(
    function_: Function,
    arguments_: FunctionArgs<Function> & Record<string, unknown>,
  ): Promise<FunctionResult<Function>> {
    return this.enqueue(async () => {
      await this.initialize();
      validateExportedValidator(
        function_.exportArgs(),
        arguments_,
        "Mutation arguments",
      );
      const result = await this.storage.transaction(
        "write",
        async (storage) => {
          const db = new MobileDatabaseWriter(
            storage,
            this.schema,
            this.createId,
            this.now,
          );
          const value = await function_._handler(
            mutationContext(db) as never,
            cloneValue(arguments_ as Value) as never,
          );
          const normalized = value === undefined ? null : value;
          validateExportedValidator(
            function_.exportReturns(),
            normalized,
            "Mutation result",
          );
          return cloneResult(normalized);
        },
      );
      await this.refreshActiveQueries();
      return result;
    }) as Promise<FunctionResult<Function>>;
  }

  queryKey(function_: PublicQuery, arguments_: Record<string, unknown>) {
    let functionId = this.functionIds.get(function_);
    if (!functionId) {
      functionId = this.nextFunctionId++;
      this.functionIds.set(function_, functionId);
    }
    return `${functionId}:${stableValueKey(arguments_ as Value)}`;
  }

  subscribeQuery(
    function_: PublicQuery,
    arguments_: Record<string, unknown>,
    listener: () => void,
  ) {
    const record = this.ensureQueryRecord(function_, arguments_);
    record.listeners.add(listener);
    if (record.status === "loading" && record.version === 0) {
      void this.enqueue(() => this.refreshQuery(record));
    }
    return () => record.listeners.delete(listener);
  }

  queryVersion(key: string) {
    return this.queries.get(key)?.version ?? 0;
  }

  queryState(key: string) {
    return this.queries.get(key);
  }

  private ensureQueryRecord(
    function_: PublicQuery,
    arguments_: Record<string, unknown>,
  ) {
    const key = this.queryKey(function_, arguments_);
    let record = this.queries.get(key);
    if (!record) {
      record = {
        arguments: cloneValue(arguments_ as Value) as Record<string, Value>,
        function: function_,
        key,
        listeners: new Set(),
        status: "loading",
        version: 0,
      };
      this.queries.set(key, record);
    }
    return record;
  }

  private async executeQuery(
    function_: PublicQuery,
    arguments_: Record<string, unknown>,
  ) {
    await this.initialize();
    validateExportedValidator(
      function_.exportArgs(),
      arguments_,
      "Query arguments",
    );
    return this.storage.transaction("read", async (storage) => {
      const db = new MobileDatabaseReader(storage, this.schema);
      const value = await function_._handler(
        queryContext(db) as never,
        cloneValue(arguments_ as Value) as never,
      );
      const normalized = value === undefined ? null : value;
      validateExportedValidator(
        function_.exportReturns(),
        normalized,
        "Query result",
      );
      return cloneResult(normalized);
    });
  }

  private async refreshActiveQueries() {
    for (const record of this.queries.values()) {
      if (record.listeners.size > 0) await this.refreshQuery(record);
    }
  }

  private async refreshQuery(record: QueryRecord) {
    try {
      record.value = await this.executeQuery(record.function, record.arguments);
      record.error = undefined;
      record.status = "success";
    } catch (error) {
      record.error = error;
      record.status = "error";
    }
    record.version += 1;
    for (const listener of record.listeners) listener();
  }

  private enqueue<T>(run: () => Promise<T>) {
    const result = this.operation.then(run, run);
    this.operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function queryContext(db: MobileDatabaseReader) {
  return {
    auth: localAuth,
    db,
    meta: unsupported("meta"),
    runQuery: unsupported("nested query calls"),
    storage: unsupported("file storage"),
  };
}

function mutationContext(db: MobileDatabaseWriter) {
  return {
    auth: localAuth,
    db,
    meta: unsupported("meta"),
    runMutation: unsupported("nested mutation calls"),
    runQuery: unsupported("nested query calls"),
    scheduler: unsupported("scheduling"),
    storage: unsupported("file storage"),
  };
}

const localAuth = {
  getUserIdentity: () => Promise.resolve(null),
};

function unsupported(feature: string) {
  return new Proxy(() => undefined, {
    apply() {
      throw new Error(`${feature} is not supported by mobile-convex yet`);
    },
    get() {
      throw new Error(`${feature} is not supported by mobile-convex yet`);
    },
  });
}

function cloneResult(value: unknown) {
  return cloneValue(value as Value);
}

let idCounter = 0;

function defaultCreateId(tableName: string) {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  const time = Date.now().toString(36);
  const sequence = idCounter.toString(36);
  const random = Math.random().toString(36).slice(2);
  return `${tableName}:${time}${sequence}${random}`;
}
