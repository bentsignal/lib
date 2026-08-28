import { View } from "react-native";

import type { NativeHeaderAction } from "./native-header-bar";
import { useColor } from "~/hooks/use-color";
import { NativeHeaderBar } from "./native-header-bar";

export function NativeSheetHeader({
  onClose,
  title,
  trailingAction,
}: {
  onClose: () => void;
  title: string;
  trailingAction?: NativeHeaderAction;
}) {
  const border = useColor("border");
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
      <NativeHeaderBar
        leadingAction={{
          label: "Close",
          onPress: onClose,
          systemImage: "xmark",
        }}
        style={{ bottom: 0, left: 0, position: "absolute", right: 0 }}
        title={title}
        trailingAction={
          trailingAction ? { ...trailingAction, prominent: true } : undefined
        }
      />
    </View>
  );
}
