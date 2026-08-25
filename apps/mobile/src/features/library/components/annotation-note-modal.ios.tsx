import { useRef, useState } from "react";
import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Host,
  Spacer,
  Text,
  TextField,
  useNativeState,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background as backgroundModifier,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
  textFieldStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type { ReaderSelectionMessage } from "../reader-annotations";
import type { ReaderAnnotation } from "~/db/catalog";
import { useAppColorScheme } from "~/features/theme/app-appearance";
import { useColor } from "~/hooks/use-color";
import { confirmDeleteNote } from "./confirm-delete-note";
import { NativeSheetHeader } from "./native-sheet-header.ios";

export function AnnotationNoteModal({
  annotation,
  chapterDraft,
  context,
  draft,
  onClose,
  onDelete,
  onSave,
  onUpdate,
}: {
  annotation?: ReaderAnnotation;
  chapterDraft?: string;
  context?: string;
  draft?: ReaderSelectionMessage;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSave: (note: string) => void;
  onUpdate: (id: string, note: string) => void;
}) {
  if (draft) {
    return (
      <NativeNoteEditor
        key={`${draft.startOffset}:${draft.endOffset}`}
        onClose={onClose}
        onSave={onSave}
        quote={draft.selectedText}
        title="Add note"
      />
    );
  }
  if (chapterDraft) {
    return (
      <NativeNoteEditor
        context={chapterDraft}
        key={chapterDraft}
        onClose={onClose}
        onSave={onSave}
        title="Note"
      />
    );
  }
  if (!annotation) return null;
  return (
    <NativeNoteEditor
      context={annotation.kind === "chapter-note" ? context : undefined}
      initialValue={annotation.note ?? ""}
      key={`${annotation.id}:${annotation.updatedAt}`}
      onClose={onClose}
      onDelete={() => onDelete(annotation.id)}
      onSave={(note) => onUpdate(annotation.id, note)}
      quote={
        annotation.kind === "chapter-note" ? undefined : annotation.selectedText
      }
      title="Edit note"
    />
  );
}

// eslint-disable-next-line max-lines-per-function -- Keeping the native form and its theme modifiers together makes the sheet's visual hierarchy easier to audit.
function NativeNoteEditor({
  context,
  initialValue = "",
  onClose,
  onDelete,
  onSave,
  quote,
  title,
}: {
  context?: string;
  initialValue?: string;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (note: string) => void;
  quote?: string;
  title: string;
}) {
  const note = useNativeState(initialValue);
  const latestNote = useRef(initialValue);
  const [canSave, setCanSave] = useState(false);
  const background = useColor("background");
  const card = useColor("card");
  const foreground = useColor("foreground");
  const muted = useColor("muted");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  const accent = useColor("accent");
  const colorScheme = useAppColorScheme();
  return (
    <Modal
      allowSwipeDismissal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="formSheet"
      visible
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ backgroundColor: background, flex: 1 }}
      >
        <NativeSheetHeader
          onClose={onClose}
          title={title}
          trailingAction={{
            disabled: !canSave,
            label: "Save",
            onPress: () => onSave(latestNote.current.trim()),
            systemImage: "checkmark",
          }}
        />
        <Host
          colorScheme={colorScheme}
          seedColor={primary}
          style={{ flex: 1 }}
          useViewportSizeMeasurement
        >
          <VStack
            alignment="leading"
            modifiers={[
              frame({ maxWidth: 1000, alignment: "topLeading" }),
              padding({ bottom: 24, horizontal: 18, top: 16 }),
            ]}
            spacing={16}
          >
            <NativeNoteContext
              background={muted}
              color={mutedForeground}
              context={context}
              quote={quote}
            />
            <TextField
              autoFocus={!initialValue}
              axis="vertical"
              modifiers={[
                textFieldStyle("plain"),
                frame({
                  minHeight: 164,
                  maxWidth: 1000,
                  alignment: "topLeading",
                }),
                font({ textStyle: "body" }),
                foregroundStyle(foreground),
                lineLimit({ max: 10, min: 6 }),
                padding({ all: 14 }),
                backgroundModifier(
                  card,
                  shapes.roundedRectangle({
                    cornerRadius: 14,
                    roundedCornerStyle: "continuous",
                  }),
                ),
              ]}
              onTextChange={(value) => {
                latestNote.current = value;
                setCanSave(
                  value.trim().length > 0 &&
                    value.trim() !== initialValue.trim(),
                );
              }}
              placeholder="Write a note…"
              text={note}
            />
            <DeleteNoteButton accent={accent} onDelete={onDelete} />
            <Spacer />
          </VStack>
        </Host>
      </SafeAreaView>
    </Modal>
  );
}

function NativeNoteContext({
  background,
  color,
  context,
  quote,
}: {
  background: string;
  color: string;
  context?: string;
  quote?: string;
}) {
  const value = quote ? `“${quote}”` : context;
  if (!value) return null;
  return (
    <Text
      modifiers={[
        frame({ maxWidth: 1000, alignment: "leading" }),
        font({ textStyle: "subheadline" }),
        foregroundStyle(color),
        lineLimit(4),
        padding({ horizontal: 14, vertical: 12 }),
        backgroundModifier(
          background,
          shapes.roundedRectangle({
            cornerRadius: 14,
            roundedCornerStyle: "continuous",
          }),
        ),
      ]}
    >
      {value}
    </Text>
  );
}

function DeleteNoteButton({
  accent,
  onDelete,
}: {
  accent: string;
  onDelete?: () => void;
}) {
  if (!onDelete) return null;
  return (
    <Button
      label="Delete note"
      modifiers={[
        frame({ height: 44, maxWidth: 1000 }),
        buttonStyle("bordered"),
        buttonBorderShape("capsule"),
        controlSize("large"),
        tint(accent),
      ]}
      onPress={() => confirmDeleteNote(onDelete)}
      role="destructive"
    />
  );
}
