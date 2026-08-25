import { useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ReaderSelectionMessage } from "../reader-annotations";
import type { ReaderAnnotation } from "~/db/catalog";
import { useColor } from "~/hooks/use-color";
import { confirmDeleteNote } from "./confirm-delete-note";

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
      <NoteEditor
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
      <NoteEditor
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
    <NoteEditor
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

function NoteEditor({
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
  const note = useRef(initialValue);
  const [canSave, setCanSave] = useState(false);
  const background = useColor("background");
  const border = useColor("border");
  const card = useColor("card");
  const foreground = useColor("foreground");
  const muted = useColor("muted");
  const mutedForeground = useColor("muted-foreground");
  const primary = useColor("primary");
  const accent = useColor("accent");
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="formSheet"
      visible
    >
      <SafeAreaView style={{ backgroundColor: background, flex: 1 }}>
        <NoteEditorHeader
          border={border}
          canSave={canSave}
          foreground={foreground}
          onClose={onClose}
          onSave={() => onSave(note.current.trim())}
          primary={primary}
          title={title}
        />
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerClassName="p-5 pb-10"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <NoteContext
            background={muted}
            color={mutedForeground}
            context={context}
            quote={quote}
          />
          <TextInput
            autoFocus={!initialValue}
            className="mt-4 min-h-44 rounded-2xl border p-4 text-[16px]"
            defaultValue={initialValue}
            multiline
            onChangeText={(value) => {
              note.current = value;
              setCanSave(
                value.trim().length > 0 && value.trim() !== initialValue.trim(),
              );
            }}
            placeholder="Write a note…"
            placeholderTextColor={mutedForeground}
            selectionColor={foreground}
            style={{
              backgroundColor: card,
              borderColor: border,
              color: foreground,
            }}
            textAlignVertical="top"
          />
          <DeleteNoteButton accent={accent} muted={muted} onDelete={onDelete} />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NoteContext({
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
  const text = quote ? `“${quote}”` : context;
  if (!text) return null;
  return (
    <View
      className="rounded-2xl px-4 py-3"
      style={{ backgroundColor: background }}
    >
      <Text className="text-sm leading-5" numberOfLines={4} style={{ color }}>
        {text}
      </Text>
    </View>
  );
}

function NoteEditorHeader({
  border,
  canSave,
  foreground,
  onClose,
  onSave,
  primary,
  title,
}: {
  border: string;
  canSave: boolean;
  foreground: string;
  onClose: () => void;
  onSave: () => void;
  primary: string;
  title: string;
}) {
  return (
    <View
      className="h-16 flex-row items-center justify-between border-b px-4"
      style={{ borderColor: border }}
    >
      <SheetButton color={primary} label="Cancel" onPress={onClose} />
      <Text className="text-[17px] font-semibold" style={{ color: foreground }}>
        {title}
      </Text>
      <SheetButton
        color={primary}
        disabled={!canSave}
        label="Save"
        onPress={onSave}
      />
    </View>
  );
}

function SheetButton({
  color,
  disabled = false,
  label,
  onPress,
}: {
  color: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-11 min-w-14 items-center justify-center active:opacity-70"
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Text className="text-[16px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

function DeleteNoteButton({
  accent,
  muted,
  onDelete,
}: {
  accent: string;
  muted: string;
  onDelete?: () => void;
}) {
  if (!onDelete) return null;
  return (
    <Pressable
      accessibilityRole="button"
      className="mt-8 h-11 items-center justify-center rounded-full active:opacity-75"
      onPress={() => confirmDeleteNote(onDelete)}
      style={{ backgroundColor: muted }}
    >
      <Text className="text-sm font-semibold" style={{ color: accent }}>
        Delete note
      </Text>
    </Pressable>
  );
}
