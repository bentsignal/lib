import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { DatabaseProvider } from "~/db/database-provider";
import { LibraryStore } from "~/features/library/library-context";
import {
  initializeAppAppearance,
  useAppColorScheme,
} from "~/features/theme/app-appearance";
import { createNavigationTheme } from "~/features/theme/navigation-theme";
import { useColor } from "~/hooks/use-color";

import "../styles.css";

initializeAppAppearance();

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 220, fade: true });

export default function RootLayout() {
  const background = useColor("background");
  const border = useColor("border");
  const foreground = useColor("foreground");
  const primary = useColor("primary");
  const colorScheme = useAppColorScheme();
  const theme = createNavigationTheme(colorScheme, {
    background,
    border,
    foreground,
    primary,
  });

  // eslint-disable-next-line no-restricted-syntax -- The native system surface and splash must follow the active app appearance.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(background);
    void SplashScreen.hideAsync();
  }, [background]);

  return (
    <GestureHandlerRootView style={{ backgroundColor: background, flex: 1 }}>
      <KeyboardProvider statusBarTranslucent>
        <SafeAreaProvider>
          <ThemeProvider value={theme}>
            <DatabaseProvider>
              <LibraryStore>
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: background },
                    headerBackButtonDisplayMode: "minimal",
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: background },
                    headerTintColor: foreground,
                  }}
                >
                  <Stack.Screen
                    name="index"
                    options={{ animation: "none", headerShown: false }}
                  />
                  <Stack.Screen
                    name="(tabs)"
                    options={{ animation: "none", headerShown: false }}
                  />
                  <Stack.Screen
                    dangerouslySingular={(_, params) =>
                      `${String(params.scope ?? "library")}:${String(params.id)}`
                    }
                    name="book/[id]/edit"
                    options={{ title: "" }}
                  />
                  <Stack.Screen name="book/[id]/overview" />
                  <Stack.Screen name="book/[id]/read" />
                  <Stack.Screen name="book/[id]/section/[sectionId]" />
                </Stack>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
              </LibraryStore>
            </DatabaseProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
