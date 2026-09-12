import type { NativeModule } from "expo";
import { requireOptionalNativeModule } from "expo";

export interface MobileConvexNativeProbe {
  backend: "convex-rust-sqlite";
  fresh: boolean;
  revision: string;
  transactionSucceeded: boolean;
}

interface MobileConvexNativeModule extends NativeModule<Record<never, never>> {
  probeAsync(databasePath: string): Promise<MobileConvexNativeProbe>;
}

const nativeModule =
  requireOptionalNativeModule<MobileConvexNativeModule>("MobileConvex");

export const isMobileConvexNativeAvailable = nativeModule !== null;

export function probeMobileConvexNativeAsync(databasePath: string) {
  if (!nativeModule) {
    throw new Error("The embedded Convex Rust engine is not available.");
  }
  return nativeModule.probeAsync(databasePath);
}
