import type { ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useState } from "react";
import { PanResponder, Platform, Pressable, Text, View } from "react-native";
import {
  KeyboardController,
  KeyboardStickyView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useAppColorScheme } from "~/features/theme/app-appearance";
import { useColor } from "~/hooks/use-color";

export function ChapterControlsPanel({
  children,
  expanded,
  header,
  onExpandedChange,
  visibility,
}: {
  children: React.ReactNode;
  expanded: boolean;
  header?: React.ReactNode;
  onExpandedChange: (expanded: boolean) => void;
  visibility?: SharedValue<number>;
}) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const card = useColor("card");
  const border = useColor("border");
  const colorScheme = useAppColorScheme();
  const [panelHeight, setPanelHeight] = useState(0);
  const visibilityStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          (1 - (visibility?.value ?? 1)) * (panelHeight + hiddenPanelClearance),
      },
    ],
  }));

  function changeExpanded(nextExpanded: boolean) {
    onExpandedChange(nextExpanded);
  }
  const panelSwipe = createPanelSwipe({
    keyboardVisible,
    onExpandedChange: changeExpanded,
  });
  const surfaceStyle = {
    borderColor: border,
    borderRadius: expanded ? 26 : 22,
    borderWidth: isLiquidGlassAvailable() ? 0 : 1,
    overflow: "hidden" as const,
  };

  return (
    <KeyboardStickyView
      enabled={keyboardVisible}
      offset={{ closed: 0, opened: 0 }}
      pointerEvents="box-none"
      style={{ bottom: 0, left: 0, position: "absolute", right: 0 }}
    >
      <Animated.View pointerEvents="box-none" style={visibilityStyle}>
        <Animated.View
          layout={panelTransition}
          onLayout={({ nativeEvent }) =>
            setPanelHeight(nativeEvent.layout.height)
          }
          pointerEvents="box-none"
          style={{
            paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12),
            paddingHorizontal: 12,
          }}
        >
          <Animated.View
            {...panelSwipe.panHandlers}
            layout={panelTransition}
            style={shadowStyle(colorScheme, surfaceStyle)}
          >
            <PanelSurface
              backgroundColor={card}
              colorScheme={colorScheme}
              style={surfaceStyle}
            >
              <View>
                <PanelHeader
                  expanded={expanded}
                  header={header}
                  onPress={() => changeExpanded(!expanded)}
                />
                <ExpandedControls expanded={expanded}>
                  {children}
                </ExpandedControls>
              </View>
            </PanelSurface>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </KeyboardStickyView>
  );
}

function PanelSurface({
  backgroundColor,
  children,
  colorScheme,
  style,
}: {
  backgroundColor: string;
  children: React.ReactElement;
  colorScheme: "dark" | "light";
  style: ViewStyle;
}) {
  if (Platform.OS !== "ios" || !isLiquidGlassAvailable()) {
    return <View style={[style, { backgroundColor }]}>{children}</View>;
  }
  return (
    <GlassView
      colorScheme={colorScheme}
      glassEffectStyle={{ animate: true, style: "regular" }}
      isInteractive
      style={style}
    >
      {children}
    </GlassView>
  );
}

function ExpandedControls({
  children,
  expanded,
}: {
  children: React.ReactNode;
  expanded: boolean;
}) {
  if (!expanded) return null;
  return <View className="gap-4 px-4 pb-4">{children}</View>;
}

function PanelHeader({
  expanded,
  header,
  onPress,
}: {
  expanded: boolean;
  header?: React.ReactNode;
  onPress: () => void;
}) {
  if (header) {
    return (
      <View className="items-center pt-2 pb-2">
        <View className="bg-muted-foreground/50 mb-1 h-1 w-9 rounded-full" />
        {header}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityHint={
        expanded ? "Collapses chapter controls" : "Expands chapter controls"
      }
      accessibilityRole="button"
      className="items-center px-5 pt-2 pb-3"
      onPress={onPress}
    >
      <View className="bg-muted-foreground/50 mb-2 h-1 w-9 rounded-full" />
      <Text className="text-foreground text-[15px] font-semibold">
        Controls
      </Text>
    </Pressable>
  );
}

function createPanelSwipe({
  keyboardVisible,
  onExpandedChange,
}: {
  keyboardVisible: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  return PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -swipeDistance) return onExpandedChange(true);
      if (gesture.dy <= swipeDistance) return;
      if (!keyboardVisible && !KeyboardController.isVisible()) {
        return onExpandedChange(false);
      }
      void KeyboardController.dismiss();
    },
  });
}

function shadowStyle(colorScheme: "dark" | "light", surface: ViewStyle) {
  return {
    borderRadius: surface.borderRadius,
    elevation: 10,
    shadowColor: "#000000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: colorScheme === "dark" ? 0.35 : 0.14,
    shadowRadius: 14,
  };
}

const swipeDistance = 28;
const hiddenPanelClearance = 16;
const panelTransition = LinearTransition.springify().damping(24).stiffness(240);
