import type { Value } from "convex/values";
import { compareValues } from "convex/values";

import type { StoredDocument } from "./types";

type Expression =
  | { kind: "constant"; value: unknown }
  | { kind: "field"; path: string }
  | {
      kind: "operation";
      operation: string;
      operands: Expression[];
    };

interface RangeConstraint {
  field: string;
  operation: "eq" | "gt" | "gte" | "lt" | "lte";
  value: Value;
}

export class MobileQuery {
  private direction: "asc" | "desc" = "asc";
  private filters: Expression[] = [];
  private indexFields: string[] = ["_creationTime", "_id"];
  private ranges: RangeConstraint[] = [];

  constructor(private readonly load: () => Promise<StoredDocument[]>) {}

  filter(build: (builder: MobileFilterBuilder) => unknown) {
    const expression = build(new MobileFilterBuilder());
    this.filters.push(asExpression(expression));
    return this;
  }

  withIndex(
    _indexName: string,
    fields: string[],
    build?: (builder: MobileIndexRangeBuilder) => unknown,
  ) {
    this.indexFields = [...fields, "_id"];
    if (build) {
      const builder = new MobileIndexRangeBuilder();
      build(builder);
      this.ranges = builder.constraints;
    }
    return this;
  }

  order(direction: "asc" | "desc") {
    this.direction = direction;
    return this;
  }

  async collect() {
    return this.results();
  }

  async first() {
    return (await this.results())[0] ?? null;
  }

  async unique() {
    const values = await this.results();
    if (values.length > 1) {
      throw new Error("A unique query returned more than one document");
    }
    return values[0] ?? null;
  }

  async take(count: number) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("take() requires a non-negative integer");
    }
    return (await this.results()).slice(0, count);
  }

  private async results() {
    const documents = await this.load();
    const filtered = documents.filter(
      (document) =>
        this.ranges.every((range) => evaluateRange(range, document)) &&
        this.filters.every((filter) => evaluate(filter, document) === true),
    );
    const multiplier = this.direction === "asc" ? 1 : -1;
    return filtered.sort(
      (left, right) =>
        multiplier * compareDocuments(left, right, this.indexFields),
    );
  }
}

export class MobileIndexRangeBuilder {
  readonly constraints: RangeConstraint[] = [];

  eq(field: string, value: Value) {
    return this.add("eq", field, value);
  }

  gt(field: string, value: Value) {
    return this.add("gt", field, value);
  }

  gte(field: string, value: Value) {
    return this.add("gte", field, value);
  }

  lt(field: string, value: Value) {
    return this.add("lt", field, value);
  }

  lte(field: string, value: Value) {
    return this.add("lte", field, value);
  }

  private add(
    operation: RangeConstraint["operation"],
    field: string,
    value: Value,
  ) {
    this.constraints.push({ field, operation, value });
    return this;
  }
}

export class MobileFilterBuilder {
  field(path: string) {
    return { kind: "field", path } satisfies Expression;
  }

  eq(left: unknown, right: unknown) {
    return this.operation("eq", left, right);
  }

  neq(left: unknown, right: unknown) {
    return this.operation("neq", left, right);
  }

  lt(left: unknown, right: unknown) {
    return this.operation("lt", left, right);
  }

  lte(left: unknown, right: unknown) {
    return this.operation("lte", left, right);
  }

  gt(left: unknown, right: unknown) {
    return this.operation("gt", left, right);
  }

  gte(left: unknown, right: unknown) {
    return this.operation("gte", left, right);
  }

  and(...expressions: unknown[]) {
    return this.operation("and", ...expressions);
  }

  or(...expressions: unknown[]) {
    return this.operation("or", ...expressions);
  }

  not(expression: unknown) {
    return this.operation("not", expression);
  }

  add(left: unknown, right: unknown) {
    return this.operation("add", left, right);
  }

  sub(left: unknown, right: unknown) {
    return this.operation("sub", left, right);
  }

  mul(left: unknown, right: unknown) {
    return this.operation("mul", left, right);
  }

  div(left: unknown, right: unknown) {
    return this.operation("div", left, right);
  }

  mod(left: unknown, right: unknown) {
    return this.operation("mod", left, right);
  }

  neg(expression: unknown) {
    return this.operation("neg", expression);
  }

  private operation(operation: string, ...operands: unknown[]) {
    return {
      kind: "operation",
      operands: operands.map(asExpression),
      operation,
    } satisfies Expression;
  }
}

function asExpression(value: unknown): Expression {
  if (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    (value.kind === "constant" ||
      value.kind === "field" ||
      value.kind === "operation")
  ) {
    return value as Expression;
  }
  return { kind: "constant", value };
}

function evaluate(expression: Expression, document: StoredDocument): unknown {
  if (expression.kind === "constant") return expression.value;
  if (expression.kind === "field") return fieldValue(document, expression.path);
  const operands = expression.operands.map((operand) =>
    evaluate(operand, document),
  );
  const [left, right] = operands;
  switch (expression.operation) {
    case "eq":
      return compare(left, right) === 0;
    case "neq":
      return compare(left, right) !== 0;
    case "lt":
      return compare(left, right) < 0;
    case "lte":
      return compare(left, right) <= 0;
    case "gt":
      return compare(left, right) > 0;
    case "gte":
      return compare(left, right) >= 0;
    case "and":
      return operands.every(Boolean);
    case "or":
      return operands.some(Boolean);
    case "not":
      return !left;
    case "add":
      return numeric(
        left,
        right,
        (a, b) => a + b,
        (a, b) => a + b,
      );
    case "sub":
      return numeric(
        left,
        right,
        (a, b) => a - b,
        (a, b) => a - b,
      );
    case "mul":
      return numeric(
        left,
        right,
        (a, b) => a * b,
        (a, b) => a * b,
      );
    case "div":
      return numeric(
        left,
        right,
        (a, b) => a / b,
        (a, b) => a / b,
      );
    case "mod":
      return numeric(
        left,
        right,
        (a, b) => a % b,
        (a, b) => a % b,
      );
    case "neg":
      if (typeof left === "number" || typeof left === "bigint") return -left;
      break;
  }
  throw new Error(`Unsupported filter operation: ${expression.operation}`);
}

function numeric(
  left: unknown,
  right: unknown,
  numbers: (left: number, right: number) => number,
  bigints: (left: bigint, right: bigint) => bigint,
) {
  if (typeof left === "number" && typeof right === "number") {
    return numbers(left, right);
  }
  if (typeof left === "bigint" && typeof right === "bigint") {
    return bigints(left, right);
  }
  throw new Error("Filter arithmetic operands must have the same numeric type");
}

function compare(left: unknown, right: unknown) {
  return compareValues(left as Value, right as Value);
}

function evaluateRange(range: RangeConstraint, document: StoredDocument) {
  const result = compare(fieldValue(document, range.field), range.value);
  switch (range.operation) {
    case "eq":
      return result === 0;
    case "gt":
      return result > 0;
    case "gte":
      return result >= 0;
    case "lt":
      return result < 0;
    case "lte":
      return result <= 0;
  }
}

function compareDocuments(
  left: StoredDocument,
  right: StoredDocument,
  fields: string[],
) {
  for (const field of fields) {
    const result = compare(fieldValue(left, field), fieldValue(right, field));
    if (result !== 0) return result;
  }
  return 0;
}

function fieldValue(document: StoredDocument, path: string): unknown {
  return path.split(".").reduce<unknown>((value, field) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[field];
  }, document);
}
