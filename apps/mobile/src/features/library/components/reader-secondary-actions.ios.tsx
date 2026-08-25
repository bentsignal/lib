import { Pressable, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { useColor } from "~/hooks/use-color";

export function ReaderSecondaryActions({
  annotationCount = 0,
  onShowAnnotations,
  onShowChapters,
  onShowOverview,
}: {
  annotationCount?: number;
  onShowAnnotations?: () => void;
  onShowChapters?: () => void;
  onShowOverview: () => void;
}) {
  const primary = useColor("primary");
  const primaryForeground = useColor("primary-foreground");
  return (
    <View className="w-full gap-2">
      <View className="flex-row gap-2">
        <ReaderAction
          background={translucent(primary)}
          foreground={primary}
          label="Chapters"
          onPress={onShowChapters}
          systemImage="list.bullet"
        />
        <ReaderAction
          background={translucent(primary)}
          foreground={primary}
          label={annotationCount > 0 ? `Saved ${annotationCount}` : "Saved"}
          onPress={onShowAnnotations}
          systemImage="highlighter"
        />
      </View>
      <ReaderAction
        background={primary}
        foreground={primaryForeground}
        label="More"
        onPress={onShowOverview}
        systemImage="book.closed"
      />
    </View>
  );
}

function translucent(color: string) {
  return /^#[\da-f]{6}$/i.test(color) ? `${color}24` : color;
}

function ReaderAction({
  background,
  foreground,
  label,
  onPress,
  systemImage,
}: {
  background: string;
  foreground: string;
  label: string;
  onPress?: () => void;
  systemImage: "book.closed" | "highlighter" | "list.bullet";
}) {
  if (!onPress) return null;
  return (
    <Pressable
      accessibilityRole="button"
      className="h-11 min-w-0 flex-1 flex-row items-center justify-center gap-2 rounded-full active:opacity-75"
      onPress={onPress}
      style={{ backgroundColor: background }}
    >
      <SymbolView
        name={systemImage}
        size={15}
        tintColor={foreground}
        weight="semibold"
      />
      <Text className="text-sm font-semibold" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}
