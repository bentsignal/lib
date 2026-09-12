import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";

import {
  isMobileConvexNativeAvailable,
  probeMobileConvexNativeAsync,
} from "@lib/mobile-convex/native";
import { MobileConvexProvider } from "@lib/mobile-convex/react";

import { readLegacyCatalog } from "~/db/catalog";
import { useColor } from "~/hooks/use-color";
import { api } from "./api";
import { mobileConvex } from "./client";

export function MobileBackendProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready" }
    | { error: Error; status: "error" }
  >({ status: "loading" });
  const primary = useColor("primary");

  // eslint-disable-next-line no-restricted-syntax -- The embedded backend must initialize and migrate before consumers subscribe.
  useEffect(() => {
    let active = true;
    void initializeBackend()
      .then(() => {
        if (active) setState({ status: "ready" });
      })
      .catch((reason: unknown) => {
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        if (active) setState({ error, status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "error") {
    return (
      <View className="bg-background flex-1 items-center justify-center px-8">
        <Text className="text-foreground text-center text-base font-semibold">
          Couldn’t start the local backend
        </Text>
        <Text className="text-muted-foreground mt-2 text-center text-sm">
          {state.error.message}
        </Text>
      </View>
    );
  }
  if (state.status === "loading") {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={primary} />
      </View>
    );
  }
  return (
    <MobileConvexProvider client={mobileConvex}>
      {children}
    </MobileConvexProvider>
  );
}

async function initializeBackend() {
  await initializeNativeProbe();
  await mobileConvex.initialize();
  const legacy = readLegacyCatalog();
  await mobileConvex.mutation(api.books.migrateLegacyCatalog, legacy);
}

async function initializeNativeProbe() {
  if (!__DEV__ || !isMobileConvexNativeAvailable) return;
  const database = new File(Paths.cache, "mobile-convex-rust-probe.sqlite");
  const probe = await probeMobileConvexNativeAsync(database.uri);
  if (probe.revision.length !== 40 || !probe.transactionSucceeded) {
    throw new Error(
      "The embedded Convex Rust engine reported an invalid build.",
    );
  }
}
