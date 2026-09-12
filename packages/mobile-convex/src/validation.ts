import type { GenericValidator, ValidatorJSON, Value } from "convex/values";
import { convexToJson, jsonToConvex } from "convex/values";

export function validateWithValidator(
  validator: GenericValidator,
  value: unknown,
  location: string,
) {
  validateJson(
    (validator as GenericValidator & { readonly json: ValidatorJSON }).json,
    value,
    location,
  );
}

export function validateExportedValidator(
  serializedValidator: string,
  value: unknown,
  location: string,
) {
  const validator = JSON.parse(serializedValidator) as ValidatorJSON | null;
  if (validator) validateJson(validator, value, location);
}

function validateJson(
  validator: ValidatorJSON,
  value: unknown,
  location: string,
): void {
  switch (validator.type) {
    case "any":
      assertConvexValue(value, location);
      return;
    case "null":
      if (value !== null) fail(location, "null", value);
      return;
    case "number":
      if (typeof value !== "number") fail(location, "number", value);
      return;
    case "bigint":
    case "commitTs":
      if (typeof value !== "bigint") fail(location, "bigint", value);
      return;
    case "boolean":
      if (typeof value !== "boolean") fail(location, "boolean", value);
      return;
    case "string":
      if (typeof value !== "string") fail(location, "string", value);
      return;
    case "bytes":
      if (!(value instanceof ArrayBuffer)) fail(location, "ArrayBuffer", value);
      return;
    case "id":
      if (
        typeof value !== "string" ||
        !value.startsWith(`${validator.tableName}:`)
      ) {
        fail(location, `an ID from "${validator.tableName}"`, value);
      }
      return;
    case "literal":
      if (!sameValue(value, jsonToConvex(validator.value))) {
        fail(location, `the literal ${JSON.stringify(validator.value)}`, value);
      }
      return;
    case "array":
      if (!Array.isArray(value)) fail(location, "an array", value);
      value.forEach((item, index) =>
        validateJson(validator.value, item, `${location}[${index}]`),
      );
      return;
    case "object":
      validateObject(validator.value, value, location);
      return;
    case "record":
      if (!isPlainObject(value)) fail(location, "an object", value);
      for (const [key, item] of Object.entries(value)) {
        validateJson(validator.keys, key, `${location} key`);
        validateJson(validator.values.fieldType, item, `${location}.${key}`);
      }
      return;
    case "union": {
      const valid = validator.value.some((member) => {
        try {
          validateJson(member, value, location);
          return true;
        } catch {
          return false;
        }
      });
      if (!valid) fail(location, "a union member", value);
    }
  }
}

function validateObject(
  fields: Extract<ValidatorJSON, { type: "object" }>["value"],
  value: unknown,
  location: string,
) {
  if (!isPlainObject(value)) fail(location, "an object", value);
  for (const key of Object.keys(value)) {
    if (!(key in fields)) {
      throw new Error(`${location} has unexpected field "${key}"`);
    }
  }
  for (const [key, field] of Object.entries(fields)) {
    const item = value[key];
    if (item === undefined && field.optional) continue;
    if (item === undefined) {
      throw new Error(`${location}.${key} is required`);
    }
    validateJson(field.fieldType, item, `${location}.${key}`);
  }
}

function assertConvexValue(value: unknown, location: string) {
  try {
    convexToJson(value as Value);
  } catch (error) {
    throw new Error(`${location} is not a Convex value`, { cause: error });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function sameValue(left: unknown, right: Value) {
  try {
    return (
      JSON.stringify(convexToJson(left as Value)) ===
      JSON.stringify(convexToJson(right))
    );
  } catch {
    return false;
  }
}

function fail(location: string, expectation: string, value: unknown): never {
  throw new Error(
    `${location} must be ${expectation}; received ${describe(value)}`,
  );
}

function describe(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}
