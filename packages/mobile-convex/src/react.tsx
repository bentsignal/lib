import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import type {
  FunctionArgs,
  FunctionResult,
  MobileConvexClient,
} from "./client";
import type {
  ExecutableRegisteredMutation,
  ExecutableRegisteredQuery,
} from "./server";

const MobileConvexContext = createContext<MobileConvexClient | null>(null);

export function MobileConvexProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client: MobileConvexClient;
}) {
  void client.initialize();
  return (
    <MobileConvexContext.Provider value={client}>
      {children}
    </MobileConvexContext.Provider>
  );
}

export function useMobileConvex() {
  const client = useContext(MobileConvexContext);
  if (!client) {
    throw new Error(
      "Mobile Convex hooks must be used inside MobileConvexProvider",
    );
  }
  return client;
}

export function useQuery<
  Function extends Pick<
    ExecutableRegisteredQuery<never, unknown>,
    "_handler" | "exportArgs" | "exportReturns" | "isPublic" | "isQuery"
  >,
>(
  function_: Function,
  arguments_: FunctionArgs<Function> & Record<string, unknown>,
) {
  const client = useMobileConvex();
  const key = client.queryKey(function_, arguments_);
  const subscribe = useCallback(
    (listener: () => void) =>
      client.subscribeQuery(function_, arguments_, listener),
    [arguments_, client, function_],
  );
  useSyncExternalStore(
    subscribe,
    () => client.queryVersion(key),
    () => 0,
  );
  const state = client.queryState(key);
  if (state?.status === "error") throw state.error;
  return (state?.status === "success" ? state.value : undefined) as
    FunctionResult<Function> | undefined;
}

export function useMutation<
  Function extends Pick<
    ExecutableRegisteredMutation<never, unknown>,
    "_handler" | "exportArgs" | "exportReturns" | "isMutation" | "isPublic"
  >,
>(function_: Function) {
  const client = useMobileConvex();
  return useMemo(
    () => (arguments_: FunctionArgs<Function> & Record<string, unknown>) =>
      client.mutation(function_, arguments_),
    [client, function_],
  );
}
