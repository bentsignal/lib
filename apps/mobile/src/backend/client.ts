import * as Crypto from "expo-crypto";

import { MobileConvexClient } from "@lib/mobile-convex";
import { createExpoSQLiteStorage } from "@lib/mobile-convex/expo-sqlite";

import { sqlite } from "~/db/database";
import { schema } from "./schema";

export const mobileConvex = new MobileConvexClient({
  createId: (tableName) => `${tableName}:${Crypto.randomUUID()}`,
  schema,
  storage: createExpoSQLiteStorage(sqlite),
});
