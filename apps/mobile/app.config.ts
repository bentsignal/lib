import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "lib",
  slug: "lib",
  owner: "directedbyshawn",
  scheme: "lib",
  version: "0.1.31",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  updates: { fallbackToCacheTimeout: 0 },
  assetBundlePatterns: ["**/*"],
  extra: {
    ...config.extra,
    eas: {
      projectId: "3b1e9a0d-2881-414e-ad00-40ce380c8d6b",
    },
  },
  ios: {
    buildNumber: "46",
    bundleIdentifier: "com.bentsignal.lib",
    supportsTablet: true,
    icon: "./assets/icons/lib.icon",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      LSApplicationQueriesSchemes: ["com.openai.chat"],
      LSSupportsOpeningDocumentsInPlace: true,
      UIFileSharingEnabled: true,
    },
  },
  android: {
    versionCode: 46,
    package: "com.bentsignal.lib",
    icon: "./assets/icon.png",
    adaptiveIcon: {
      backgroundColor: "#111316",
      foregroundImage: "./assets/icon.png",
    },
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
    reactCompiler: true,
  },
  plugins: [
    "expo-router",
    [
      "expo-file-system",
      {
        enableFileSharing: true,
        supportsOpeningDocumentsInPlace: true,
      },
    ],
    "expo-system-ui",
    "expo-font",
    [
      "expo-image-picker",
      {
        cameraPermission: false,
        microphonePermission: false,
        photosPermission: "Allow lib to choose a photo for a book cover.",
      },
    ],
    "expo-sharing",
    "expo-status-bar",
    [
      "./expo-plugins/with-ios-alternate-icons.cjs",
      {
        icons: [
          {
            name: "IconPaper",
            path: "./assets/icons/IconPaper.icon",
          },
          {
            name: "IconForest",
            path: "./assets/icons/IconForest.icon",
          },
          {
            name: "IconInk",
            path: "./assets/icons/IconInk.icon",
          },
          {
            name: "IconClay",
            path: "./assets/icons/IconClay.icon",
          },
          {
            name: "IconPlum",
            path: "./assets/icons/IconPlum.icon",
          },
        ],
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
        },
      },
    ],
    "./expo-plugins/with-ios-scene-lifecycle.cjs",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f4f0e6",
        image: "./assets/splash-icon.png",
        imageWidth: 180,
      },
    ],
  ],
});
