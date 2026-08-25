import { Button, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type { ReaderAnnotation } from "~/db/catalog";

export function NativeAnnotationRow({
  annotation,
  background,
  foreground,
  last,
  mutedForeground,
  onPress,
  primary,
}: {
  annotation: ReaderAnnotation;
  background: string;
  foreground: string;
  last: boolean;
  mutedForeground: string;
  onPress: () => void;
  primary: string;
}) {
  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        listRowBackground(background),
        listRowInsets({ bottom: 13, leading: 20, top: 13, trailing: 16 }),
        listRowSeparator(last ? "hidden" : "visible", "bottom"),
        tint(primary),
      ]}
      onPress={onPress}
    >
      <HStack
        alignment="center"
        modifiers={[contentShape(shapes.rectangle())]}
        spacing={12}
      >
        <VStack alignment="leading" spacing={5}>
          <Text
            modifiers={[
              font({ textStyle: "caption", weight: "semibold" }),
              foregroundStyle(primary),
            ]}
          >
            {annotationKindLabel(annotation)}
          </Text>
          <AnnotationPassage annotation={annotation} color={foreground} />
          <AnnotationNote color={mutedForeground} note={annotation.note} />
        </VStack>
        <Spacer />
        <Image color={mutedForeground} size={12} systemName="chevron.right" />
      </HStack>
    </Button>
  );
}

function AnnotationPassage({
  annotation,
  color,
}: {
  annotation: ReaderAnnotation;
  color: string;
}) {
  if (!annotation.selectedText) return null;
  return (
    <Text
      modifiers={[
        font({ textStyle: "body" }),
        foregroundStyle(color),
        lineLimit(3),
      ]}
    >
      {`“${annotation.selectedText}”`}
    </Text>
  );
}

function AnnotationNote({
  color,
  note,
}: {
  color: string;
  note: string | null;
}) {
  if (!note) return null;
  return (
    <Text
      modifiers={[
        font({ textStyle: "subheadline" }),
        foregroundStyle(color),
        lineLimit(2),
      ]}
    >
      {note}
    </Text>
  );
}

function annotationKindLabel(annotation: ReaderAnnotation) {
  if (annotation.kind === "chapter-note") return "NOTE";
  return annotation.kind === "note" ? "PASSAGE NOTE" : "HIGHLIGHT";
}
