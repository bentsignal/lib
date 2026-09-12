import type {
  DataModelFromSchemaDefinition,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericSchema,
  RegisteredMutation,
  RegisteredQuery,
  SchemaDefinition,
} from "convex/server";
import type {
  GenericValidator,
  ObjectType,
  PropertyValidators,
} from "convex/values";
import { mutationGeneric, queryGeneric } from "convex/server";

export {
  defineSchema,
  defineTable,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
export type {
  DataModelFromSchemaDefinition,
  GenericDatabaseReader,
  GenericDatabaseWriter,
  GenericSchema,
  GenericMutationCtx,
  GenericQueryCtx,
  RegisteredMutation,
  RegisteredQuery,
  SchemaDefinition,
} from "convex/server";

export type ExecutableRegisteredQuery<
  Args extends Record<string, unknown>,
  Returns,
> = RegisteredQuery<"public", Args, Returns> & {
  readonly __mobileArgs: Args;
  readonly __mobileReturns: Returns;
  _handler: (context: GenericQueryCtx<never>, args: Args) => Returns;
  exportArgs: () => string;
  exportReturns: () => string;
};

export type ExecutableRegisteredMutation<
  Args extends Record<string, unknown>,
  Returns,
> = RegisteredMutation<"public", Args, Returns> & {
  readonly __mobileArgs: Args;
  readonly __mobileReturns: Returns;
  _handler: (context: GenericMutationCtx<never>, args: Args) => Returns;
  exportArgs: () => string;
  exportReturns: () => string;
};

export type MobileQueryBuilder<DataModel extends GenericDataModel> = <
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends GenericValidator,
  Returns,
>(definition: {
  args: ArgsValidator;
  handler: (
    context: GenericQueryCtx<DataModel>,
    args: ObjectType<ArgsValidator>,
  ) => Returns;
  returns: ReturnsValidator;
}) => ExecutableRegisteredQuery<ObjectType<ArgsValidator>, Returns>;

export type MobileMutationBuilder<DataModel extends GenericDataModel> = <
  ArgsValidator extends PropertyValidators,
  ReturnsValidator extends GenericValidator,
  Returns,
>(definition: {
  args: ArgsValidator;
  handler: (
    context: GenericMutationCtx<DataModel>,
    args: ObjectType<ArgsValidator>,
  ) => Returns;
  returns: ReturnsValidator;
}) => ExecutableRegisteredMutation<ObjectType<ArgsValidator>, Returns>;

export function createMobileConvexServer<
  Schema extends SchemaDefinition<GenericSchema, boolean>,
>(_schema: Schema) {
  type DataModel = DataModelFromSchemaDefinition<Schema>;
  return {
    mutation: mutationGeneric as unknown as MobileMutationBuilder<DataModel>,
    query: queryGeneric as unknown as MobileQueryBuilder<DataModel>,
  };
}

export function createApi<const Api>(api: Api) {
  return api;
}
