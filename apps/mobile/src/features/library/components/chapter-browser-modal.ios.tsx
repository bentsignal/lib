import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Spacer,
  Text,
} from "@expo/ui/swift-ui";
import {
  background as backgroundModifier,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listStyle,
  padding,
  scrollContentBackground,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type { BookSection } from "@lib/ebook-core";

import { useAppColorScheme } from "~/features/theme/app-appearance";
import { useColor } from "~/hooks/use-color";
import { NativeSheetHeader } from "./native-sheet-header.ios";

export function ChapterBrowserModal({
  currentIndex,
  onClose,
  onSelect,
  sections,
  visible,
}: {
  currentIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
  sections: BookSection[];
  visible: boolean;
}) {
  const background = useColor("background");
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  const colorScheme = useAppColorScheme();
  return (
    <Modal
      allowSwipeDismissal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView
        edges={["top"]}
        style={{ backgroundColor: background, flex: 1 }}
      >
        <NativeSheetHeader onClose={onClose} title="Chapters" />
        <View style={{ flex: 1 }}>
          <ChapterList
            background={background}
            colorScheme={colorScheme}
            currentIndex={currentIndex}
            foreground={foreground}
            mutedForeground={mutedForeground}
            onSelect={onSelect}
            primary={primary}
            sections={sections}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ChapterList({
  background,
  colorScheme,
  currentIndex,
  foreground,
  mutedForeground,
  onSelect,
  primary,
  sections,
}: {
  background: string;
  colorScheme: "dark" | "light";
  currentIndex: number;
  foreground: string;
  mutedForeground: string;
  onSelect: (index: number) => void;
  primary: string;
  sections: BookSection[];
}) {
  return (
    <Host colorScheme={colorScheme} seedColor={primary} style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle("plain"),
          scrollContentBackground("hidden"),
          backgroundModifier(background),
        ]}
      >
        {sections.map((section, index) => (
          <ChapterRow
            background={background}
            current={index === currentIndex}
            foreground={foreground}
            index={index}
            key={section.id}
            mutedForeground={mutedForeground}
            onPress={() => onSelect(index)}
            primary={primary}
            section={section}
          />
        ))}
      </List>
    </Host>
  );
}

function ChapterRow({
  background,
  current,
  foreground,
  index,
  mutedForeground,
  onPress,
  primary,
  section,
}: {
  background: string;
  current: boolean;
  foreground: string;
  index: number;
  mutedForeground: string;
  onPress: () => void;
  primary: string;
  section: BookSection;
}) {
  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        listRowBackground(background),
        listRowInsets({ bottom: 0, leading: 16, top: 0, trailing: 16 }),
        listRowSeparator("hidden", "bottom"),
        tint(primary),
      ]}
      onPress={onPress}
    >
      <HStack
        alignment="center"
        modifiers={[
          frame({ minHeight: 60, maxWidth: 1000 }),
          padding({ vertical: 2 }),
        ]}
        spacing={12}
      >
        <Text
          modifiers={[
            frame({ width: 28, alignment: "trailing" }),
            font({ textStyle: "caption" }),
            foregroundStyle(mutedForeground),
          ]}
        >
          {(index + 1).toString()}
        </Text>
        <Text
          modifiers={[
            font({
              textStyle: "body",
              weight: current ? "semibold" : "regular",
            }),
            foregroundStyle(current ? primary : foreground),
            lineLimit(2),
          ]}
        >
          {section.title}
        </Text>
        <Spacer />
        <CurrentChapterIndicator current={current} primary={primary} />
      </HStack>
    </Button>
  );
}

function CurrentChapterIndicator({
  current,
  primary,
}: {
  current: boolean;
  primary: string;
}) {
  if (!current) return null;
  return <Image color={primary} size={16} systemName="checkmark.circle.fill" />;
}
