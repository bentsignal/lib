import type { SFSymbol } from "expo-symbols";
import type { ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";

import { useAppColorScheme } from "~/features/theme/app-appearance";
import { useColor } from "~/hooks/use-color";

interface SheetAction {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  systemImage: SFSymbol;
}

const sheetActionSize = 48;

export function NativeSheetHeader({
  onClose,
  title,
  trailingAction,
}: {
  onClose: () => void;
  title: string;
  trailingAction?: SheetAction;
}) {
  const border = useColor("border");
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  return (
    <View
      className="h-[82px]"
      style={{ borderBottomColor: border, borderBottomWidth: 0.5 }}
    >
      <View
        className="absolute top-1.5 w-full items-center"
        pointerEvents="none"
      >
        <View
          className="h-1 w-9 rounded-full"
          style={{ backgroundColor: mutedForeground, opacity: 0.45 }}
        />
      </View>
      <View
        className="absolute top-3 bottom-0 w-full items-center justify-center px-16"
        pointerEvents="none"
      >
        <Text
          className="text-center text-[17px] font-semibold"
          numberOfLines={1}
          style={{ color: foreground }}
        >
          {title}
        </Text>
      </View>
      <View className="h-full flex-row items-center justify-between px-3 pt-3">
        <SheetActionButton
          label="Close"
          onPress={onClose}
          systemImage="xmark"
        />
        <TrailingSheetAction action={trailingAction} />
      </View>
    </View>
  );
}

function TrailingSheetAction({ action }: { action: SheetAction | undefined }) {
  if (!action) return <View style={actionStyle} />;
  return (
    <SheetActionButton
      disabled={action.disabled}
      label={action.label}
      onPress={action.onPress}
      prominent
      systemImage={action.systemImage}
    />
  );
}

function SheetActionButton({
  disabled = false,
  label,
  onPress,
  prominent = false,
  systemImage,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  prominent?: boolean;
  systemImage: SFSymbol;
}) {
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
      style={({ pressed }) => [actionStyle, pressed && pressedActionStyle]}
    >
      <SheetActionSurface
        background={background}
        border={border}
        colorScheme={colorScheme}
        disabled={disabled}
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

function SheetActionSurface({
  background,
  border,
  colorScheme,
  disabled,
  tintColor,
}: {
  background: string;
  border: string;
  colorScheme: "dark" | "light";
  disabled: boolean;
  tintColor?: string;
}) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        colorScheme={colorScheme}
        glassEffectStyle="regular"
        isInteractive={!disabled}
        pointerEvents="none"
        style={surfaceStyle}
        tintColor={tintColor}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        surfaceStyle,
        {
          backgroundColor: tintColor ?? background,
          borderColor: border,
          borderWidth: 0.5,
        },
      ]}
    />
  );
}

const actionStyle = {
  alignItems: "center",
  height: sheetActionSize,
  justifyContent: "center",
  width: sheetActionSize,
} satisfies ViewStyle;

const pressedActionStyle = { opacity: 0.72 } satisfies ViewStyle;

const surfaceStyle = {
  borderRadius: sheetActionSize / 2,
  bottom: 0,
  left: 0,
  overflow: "hidden",
  position: "absolute",
  right: 0,
  top: 0,
} satisfies ViewStyle;
