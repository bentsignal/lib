import { describe, expect, it } from "vitest";

import { MobileConvexClient } from "./client";
import { MemoryMobileConvexStorage } from "./memory-storage";
import { createMobileConvexServer, defineSchema, defineTable } from "./server";
import { v } from "./values";

const schema = defineSchema({
  tasks: defineTable({
    completed: v.boolean(),
    order: v.number(),
    text: v.string(),
  }).index("by_completed_and_order", ["completed", "order"]),
});

const { mutation, query } = createMobileConvexServer(schema);

const listTasks = query({
  args: { completed: v.boolean() },
  returns: v.array(schema.doc("tasks")),
  handler: (context, { completed }) =>
    context.db
      .query("tasks")
      .withIndex("by_completed_and_order", (range) =>
        range.eq("completed", completed),
      )
      .collect(),
});

const addTask = mutation({
  args: { order: v.number(), text: v.string() },
  returns: v.id("tasks"),
  handler: (context, { order, text }) =>
    context.db.insert("tasks", { completed: false, order, text }),
});

const addThenFail = mutation({
  args: { text: v.string() },
  returns: v.null(),
  handler: async (context, { text }) => {
    await context.db.insert("tasks", { completed: false, order: 0, text });
    throw new Error("rollback");
  },
});

function createClient() {
  let id = 0;
  return new MobileConvexClient({
    createId: (tableName) => `${tableName}:test-${++id}`,
    now: () => 123,
    schema,
    storage: new MemoryMobileConvexStorage(),
  });
}

describe("MobileConvexClient", () => {
  it("executes real Convex functions with typed index queries", async () => {
    const client = createClient();
    await client.mutation(addTask, { order: 2, text: "second" });
    await client.mutation(addTask, { order: 1, text: "first" });

    const tasks = await client.query(listTasks, { completed: false });

    expect(tasks.map(({ text }) => text)).toEqual(["first", "second"]);
    expect(tasks[0]).toMatchObject({
      _creationTime: 123,
      _id: "tasks:test-2",
    });
  });

  it("rolls back every write when a mutation throws", async () => {
    const client = createClient();

    await expect(
      client.mutation(addThenFail, { text: "never committed" }),
    ).rejects.toThrow("rollback");

    await expect(
      client.query(listTasks, { completed: false }),
    ).resolves.toEqual([]);
  });

  it("reruns active reactive queries after a committed mutation", async () => {
    const client = createClient();
    const versions = new Array<number>();
    const key = client.queryKey(listTasks, { completed: false });
    const unsubscribe = client.subscribeQuery(
      listTasks,
      { completed: false },
      () => versions.push(client.queryVersion(key)),
    );
    await waitFor(() => client.queryState(key)?.status === "success");

    await client.mutation(addTask, { order: 1, text: "reactive" });

    expect(client.queryState(key)?.value).toMatchObject([{ text: "reactive" }]);
    expect(versions.length).toBeGreaterThanOrEqual(2);
    unsubscribe();
  });

  it("validates function arguments before starting a transaction", async () => {
    const client = createClient();

    await expect(
      client.mutation(addTask, { order: 1, text: 42 } as never),
    ).rejects.toThrow("Mutation arguments.text must be string");
  });
});

async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not met");
}
