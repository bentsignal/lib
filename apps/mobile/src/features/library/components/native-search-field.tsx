import type { StyleProp, ViewStyle } from "react-native";
import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { useColor } from "~/hooks/use-color";

export function NativeSearchField({
  containerStyle,
  label,
  onChange,
  placeholder,
  value,
}: {
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const input = useRef<TextInput>(null);
  const foreground = useColor("foreground");
  const muted = useColor("muted");
  const mutedForeground = useColor("muted-foreground");
  return (
    <View
      className="h-10 flex-row items-center gap-2 rounded-[13px] px-3"
      style={[{ backgroundColor: muted }, containerStyle]}
    >
      <SymbolView
        name="magnifyingglass"
        size={15}
        tintColor={mutedForeground}
      />
      <TextInput
        ref={input}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="min-w-0 flex-1 text-[16px]"
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={mutedForeground}
        returnKeyType="search"
        style={{ color: foreground }}
      />
      <ClearSearchButton
        color={mutedForeground}
        onClear={() => {
          input.current?.clear();
          onChange("");
        }}
        value={value}
      />
    </View>
  );
}

function ClearSearchButton({
  color,
  onClear,
  value,
}: {
  color: string;
  onClear: () => void;
  value: string;
}) {
  if (!value) return null;
  return (
    <Pressable
      accessibilityLabel="Clear search"
      accessibilityRole="button"
      className="h-8 w-8 items-center justify-center"
      onPress={onClear}
    >
      <SymbolView name="xmark.circle.fill" size={16} tintColor={color} />
    </Pressable>
  );
}
