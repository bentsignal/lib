import type { JSONValue, Value } from "convex/values";
import { convexToJson, jsonToConvex } from "convex/values";

export function encodeValue(value: Value) {
  return JSON.stringify(convexToJson(value));
}

export function decodeValue(value: string) {
  return jsonToConvex(JSON.parse(value) as JSONValue);
}

export function cloneValue<T extends Value>(value: T): T {
  return jsonToConvex(convexToJson(value)) as T;
}

export function stableValueKey(value: Value) {
  return JSON.stringify(sortJson(convexToJson(value)));
}

function sortJson(value: JSONValue): JSONValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortJson(item)]),
  );
}
