import type { TextFieldRef } from "@expo/ui/swift-ui";
import type { StyleProp, ViewStyle } from "react-native";
import { useRef } from "react";
import {
  Button,
  Host,
  HStack,
  Image,
  Spacer,
  Text,
  TextField,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  padding,
  shapes,
  textFieldStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { useAppColorScheme } from "~/features/theme/app-appearance";
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
  const searchRef = useRef<TextFieldRef>(null);
  const colorScheme = useAppColorScheme();
  const foreground = useColor("foreground");
  const muted = useColor("muted");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  return (
    <Host
      colorScheme={colorScheme}
      seedColor={primary}
      style={[{ height: 40 }, containerStyle]}
    >
      <HStack
        alignment="center"
        modifiers={[
          frame({ height: 40 }),
          padding({ horizontal: 12 }),
          background(
            muted,
            shapes.roundedRectangle({
              cornerRadius: 13,
              roundedCornerStyle: "continuous",
            }),
          ),
        ]}
        spacing={8}
      >
        <Image color={mutedForeground} size={15} systemName="magnifyingglass" />
        <TextField
          ref={searchRef}
          modifiers={[
            accessibilityLabel(label),
            textFieldStyle("plain"),
            font({ textStyle: "body" }),
            foregroundStyle(foreground),
          ]}
          onTextChange={onChange}
        >
          <TextField.Placeholder>
            <Text modifiers={[foregroundStyle(mutedForeground)]}>
              {placeholder}
            </Text>
          </TextField.Placeholder>
        </TextField>
        <Spacer minLength={0} />
        <ClearSearchButton
          color={mutedForeground}
          onClear={() => {
            void searchRef.current?.clear();
            onChange("");
          }}
          value={value}
        />
      </HStack>
    </Host>
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
    <Button
      label="Clear search"
      modifiers={[buttonStyle("plain"), labelStyle("iconOnly"), tint(color)]}
      onPress={onClear}
      systemImage="xmark.circle.fill"
    />
  );
}
