import { Text } from "react-native";
import { SymbolView } from "expo-symbols";

import { useColor } from "~/hooks/use-color";
import { NativeSearchField } from "../components/native-search-field";

export function OverviewSearchField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <NativeSearchField
      label={label}
      onChange={onChange}
      placeholder={placeholder}
      value={value}
    />
  );
}

export function OverviewEmptyMessage({ text }: { text: string }) {
  return (
    <Text className="text-muted-foreground px-6 py-12 text-center text-sm leading-5">
      {text}
    </Text>
  );
}

export function OverviewSymbol({
  name,
}: {
  name: "chevron.right" | "magnifyingglass" | "pencil" | "xmark.circle.fill";
}) {
  const color = useColor("muted-foreground");
  return (
    <SymbolView name={name} size={16} tintColor={color} weight="semibold" />
  );
}
