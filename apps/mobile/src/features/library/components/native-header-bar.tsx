import type { SFSymbol } from "expo-symbols";
import type { StyleProp, ViewStyle } from "react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";

import { useAppColorScheme } from "~/features/theme/app-appearance";
import { useColor } from "~/hooks/use-color";

export interface NativeHeaderAction {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  prominent?: boolean;
  systemImage: SFSymbol;
}

export function NativeHeaderBar({
  compact = false,
  leadingAction,
  style,
  title,
  trailingAction,
}: {
  compact?: boolean;
  leadingAction?: NativeHeaderAction;
  style?: StyleProp<ViewStyle>;
  title: string;
  trailingAction?: NativeHeaderAction;
}) {
  const foreground = useColor("foreground");
  const actionSize = compact ? compactHeaderActionSize : headerActionSize;
  const titleInset = headerHorizontalPadding + actionSize + titleActionGap;
  return (
    <View style={[barStyle, compact && compactBarStyle, style]}>
      <View
        className="absolute inset-0 items-center justify-center"
        pointerEvents="none"
        style={{ paddingHorizontal: titleInset }}
      >
        <Text
          className="text-center text-[17px] font-semibold"
          numberOfLines={1}
          style={{ color: foreground }}
        >
          {title}
        </Text>
      </View>
      <View className="h-full flex-row items-center justify-between px-3">
        <HeaderActionSlot action={leadingAction} size={actionSize} />
        <HeaderActionSlot action={trailingAction} size={actionSize} />
      </View>
    </View>
  );
}

function HeaderActionSlot({
  action,
  size,
}: {
  action: NativeHeaderAction | undefined;
  size: number;
}) {
  const style = actionStyle(size);
  if (!action) return <View style={style} />;
  return <NativeHeaderActionButton {...action} size={size} />;
}

function NativeHeaderActionButton({
  disabled = false,
  label,
  onPress,
  prominent = false,
  size,
  systemImage,
}: NativeHeaderAction & { size: number }) {
  const background = useColor("background");
  const border = useColor("border");
  const foreground = useColor("foreground");
  const muted = useColor("muted");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  const primaryForeground = useColor("primary-foreground");
  const colorScheme = useAppColorScheme();
  let iconColor = foreground;
  let tintColor: string | undefined;
  if (prominent) {
    iconColor = primaryForeground;
    tintColor = primary;
  }
  if (disabled) {
    iconColor = mutedForeground;
    tintColor = muted;
  }
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        actionStyle(size),
        pressed && pressedActionStyle,
      ]}
    >
      <HeaderActionSurface
        background={background}
        border={border}
        colorScheme={colorScheme}
        disabled={disabled}
        size={size}
        tintColor={tintColor}
      />
      <SymbolView
        name={systemImage}
        size={20}
        tintColor={iconColor}
        weight="semibold"
      />
    </Pressable>
  );
}

function HeaderActionSurface({
  background,
  border,
  colorScheme,
  disabled,
  size,
  tintColor,
}: {
  background: string;
  border: string;
  colorScheme: "dark" | "light";
  disabled: boolean;
  size: number;
  tintColor?: string;
}) {
  const style = surfaceStyle(size);
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView
        colorScheme={colorScheme}
        glassEffectStyle="regular"
        isInteractive={!disabled}
        pointerEvents="none"
        style={style}
        tintColor={tintColor}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        style,
        {
          backgroundColor: tintColor ?? background,
          borderColor: border,
          borderWidth: 0.5,
        },
      ]}
    />
  );
}

const headerActionSize = 48;
const compactHeaderActionSize = 44;
const headerHorizontalPadding = 12;
const titleActionGap = 4;

const barStyle = {
  height: 70,
} satisfies ViewStyle;

const compactBarStyle = {
  height: 54,
} satisfies ViewStyle;

function actionStyle(size: number) {
  return {
    alignItems: "center",
    height: size,
    justifyContent: "center",
    width: size,
  } satisfies ViewStyle;
}

const pressedActionStyle = { opacity: 0.72 } satisfies ViewStyle;

function surfaceStyle(size: number) {
  return {
    borderRadius: size / 2,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  } satisfies ViewStyle;
}
