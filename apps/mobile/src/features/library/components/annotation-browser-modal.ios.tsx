import { useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Host, Image, List, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background as backgroundModifier,
  font,
  foregroundStyle,
  frame,
  listStyle,
  multilineTextAlignment,
  padding,
  scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";

import type { ReaderAnnotation } from "~/db/catalog";
import { useAppColorScheme } from "~/features/theme/app-appearance";
import { useColor } from "~/hooks/use-color";
import { NativeAnnotationRow } from "./annotation-row.ios";
import { NativeSearchField } from "./native-search-field";
import { NativeSheetHeader } from "./native-sheet-header.ios";

export function AnnotationBrowserModal({
  annotations,
  onAddNote,
  onClose,
  onSelect,
  visible,
}: {
  annotations: ReaderAnnotation[];
  onAddNote?: () => void;
  onClose: () => void;
  onSelect: (annotation: ReaderAnnotation) => void;
  visible: boolean;
}) {
  const [query, setQuery] = useState("");
  const background = useColor("background");
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  const colorScheme = useAppColorScheme();
  const results = filterAnnotations(annotations, query);
  return (
    <Modal
      allowSwipeDismissal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ backgroundColor: background, flex: 1 }}
      >
        <NativeSheetHeader
          onClose={onClose}
          title="Notes & highlights"
          trailingAction={
            onAddNote
              ? {
                  label: "New",
                  onPress: onAddNote,
                  systemImage: "square.and.pencil",
                }
              : undefined
          }
        />
        <NativeSearchField
          containerStyle={{ marginHorizontal: 16, marginVertical: 12 }}
          label="Search notes and highlights"
          onChange={setQuery}
          placeholder="Search saved passages"
          value={query}
        />
        <View style={{ flex: 1 }}>
          <AnnotationResults
            background={background}
            colorScheme={colorScheme}
            foreground={foreground}
            mutedForeground={mutedForeground}
            onSelect={onSelect}
            primary={primary}
            query={query}
            results={results}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function AnnotationResults({
  background,
  colorScheme,
  foreground,
  mutedForeground,
  onSelect,
  primary,
  query,
  results,
}: {
  background: string;
  colorScheme: "dark" | "light";
  foreground: string;
  mutedForeground: string;
  onSelect: (annotation: ReaderAnnotation) => void;
  primary: string;
  query: string;
  results: ReaderAnnotation[];
}) {
  if (results.length === 0) {
    const empty = annotationEmptyState(query);
    return (
      <Host colorScheme={colorScheme} seedColor={primary} style={{ flex: 1 }}>
        <VStack
          alignment="center"
          modifiers={[
            frame({ maxHeight: 1000, maxWidth: 1000 }),
            padding({ horizontal: 36 }),
          ]}
          spacing={8}
        >
          <Spacer />
          <Image
            color={mutedForeground}
            size={30}
            systemName={empty.systemImage}
          />
          <Text
            modifiers={[
              font({ textStyle: "headline" }),
              foregroundStyle(foreground),
              multilineTextAlignment("center"),
            ]}
          >
            {empty.title}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "subheadline" }),
              foregroundStyle(mutedForeground),
              multilineTextAlignment("center"),
            ]}
          >
            {empty.description}
          </Text>
          <Spacer />
        </VStack>
      </Host>
    );
  }
  return (
    <Host colorScheme={colorScheme} seedColor={primary} style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle("plain"),
          scrollContentBackground("hidden"),
          backgroundModifier(background),
        ]}
      >
        {results.map((annotation) => (
          <NativeAnnotationRow
            annotation={annotation}
            background={background}
            foreground={foreground}
            key={annotation.id}
            last={annotation.id === results.at(-1)?.id}
            mutedForeground={mutedForeground}
            onPress={() => onSelect(annotation)}
            primary={primary}
          />
        ))}
      </List>
    </Host>
  );
}

function annotationEmptyState(query: string) {
  if (query) {
    return {
      description: "Try another word or phrase.",
      systemImage: "magnifyingglass" as const,
      title: "No matches",
    };
  }
  return {
    description: "Select text while reading to add a highlight or note.",
    systemImage: "bookmark" as const,
    title: "Nothing saved yet",
  };
}

function filterAnnotations(annotations: ReaderAnnotation[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return annotations;
  return annotations.filter(
    (annotation) =>
      annotation.selectedText.toLocaleLowerCase().includes(normalized) ||
      annotation.note?.toLocaleLowerCase().includes(normalized),
  );
}
