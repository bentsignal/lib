import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { BookRecord } from "@lib/ebook-core";

import type { BookScope, ReaderAnnotation } from "~/db/catalog";
import {
  deleteReaderAnnotation,
  updateReaderAnnotationNote,
} from "~/db/catalog";
import { AnnotationNoteModal } from "../components/annotation-note-modal";
import {
  OverviewEmptyMessage,
  OverviewSearchField,
  OverviewSymbol,
} from "./book-overview-ui";

export function BookOverviewSaved({
  annotations,
  book,
  scope,
}: {
  annotations: ReaderAnnotation[];
  book: BookRecord;
  scope: BookScope;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReaderAnnotation>();
  const results = filterSavedItems(annotations, book, query);
  const selectedSection = book.sections.find(
    (item) => item.id === selected?.sectionId,
  );
  return (
    <View className="mt-6">
      <OverviewSearchField
        label="Search notes and highlights"
        onChange={setQuery}
        placeholder="Search saved items"
        value={query}
      />
      <SavedResults
        annotations={results}
        book={book}
        onEdit={setSelected}
        query={query}
        scope={scope}
      />
      <AnnotationNoteModal
        annotation={selected}
        context={selectedSection?.title}
        onClose={() => setSelected(undefined)}
        onDelete={(id) => {
          deleteReaderAnnotation(id);
          setSelected(undefined);
        }}
        onSave={() => undefined}
        onUpdate={(id, note) => {
          updateReaderAnnotationNote(id, note);
          setSelected(undefined);
        }}
      />
    </View>
  );
}

function SavedResults({
  annotations,
  book,
  onEdit,
  query,
  scope,
}: {
  annotations: ReaderAnnotation[];
  book: BookRecord;
  onEdit: (annotation: ReaderAnnotation) => void;
  query: string;
  scope: BookScope;
}) {
  if (annotations.length === 0) {
    const text = query.trim()
      ? "No saved items match that search"
      : "Highlights, passage notes, and chapter notes appear here";
    return <OverviewEmptyMessage text={text} />;
  }
  return (
    <View>
      {annotations.map((annotation) => (
        <SavedItemRow
          annotation={annotation}
          book={book}
          key={annotation.id}
          onEdit={() => onEdit(annotation)}
          scope={scope}
        />
      ))}
    </View>
  );
}

function SavedItemRow({
  annotation,
  book,
  onEdit,
  scope,
}: {
  annotation: ReaderAnnotation;
  book: BookRecord;
  onEdit: () => void;
  scope: BookScope;
}) {
  const router = useRouter();
  const section = book.sections.find(
    (item) => item.id === annotation.sectionId,
  );
  return (
    <View className="border-border bg-card mt-3 flex-row items-center rounded-2xl border">
      <Pressable
        accessibilityRole="button"
        className="min-w-0 flex-1 p-4 active:opacity-75"
        onPress={() =>
          router.push({
            pathname: "/book/[id]/read",
            params: readerDestination(annotation, book, scope),
          })
        }
      >
        <Text className="text-primary text-xs font-semibold tracking-wide uppercase">
          {savedItemLabel(annotation)} · {section?.title ?? "Chapter"}
        </Text>
        <SavedPassage annotation={annotation} />
        <SavedNote annotation={annotation} />
      </Pressable>
      <SavedAccessory annotation={annotation} onEdit={onEdit} />
    </View>
  );
}

function SavedPassage({ annotation }: { annotation: ReaderAnnotation }) {
  if (!annotation.selectedText) return null;
  return (
    <Text
      className="text-foreground mt-2 text-[15px] leading-6"
      numberOfLines={3}
    >
      “{annotation.selectedText}”
    </Text>
  );
}

function SavedNote({ annotation }: { annotation: ReaderAnnotation }) {
  if (!annotation.note) return null;
  return (
    <Text
      className="text-muted-foreground mt-2 text-sm leading-5"
      numberOfLines={3}
    >
      {annotation.note}
    </Text>
  );
}

function SavedAccessory({
  annotation,
  onEdit,
}: {
  annotation: ReaderAnnotation;
  onEdit: () => void;
}) {
  if (annotation.kind === "highlight") {
    return (
      <View className="h-14 w-14 items-center justify-center">
        <OverviewSymbol name="chevron.right" />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityLabel="Edit note"
      accessibilityRole="button"
      className="h-14 w-14 items-center justify-center active:opacity-70"
      onPress={onEdit}
    >
      <OverviewSymbol name="pencil" />
    </Pressable>
  );
}

function filterSavedItems(
  annotations: ReaderAnnotation[],
  book: BookRecord,
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return annotations;
  return annotations.filter((annotation) => {
    const section = book.sections.find(
      (item) => item.id === annotation.sectionId,
    );
    return (
      annotation.selectedText.toLocaleLowerCase().includes(normalized) ||
      (annotation.note?.toLocaleLowerCase().includes(normalized) ?? false) ||
      (section?.title.toLocaleLowerCase().includes(normalized) ?? false)
    );
  });
}

function readerDestination(
  annotation: ReaderAnnotation,
  book: BookRecord,
  scope: BookScope,
) {
  const anchor =
    annotation.kind === "chapter-note" ? {} : { annotationId: annotation.id };
  return {
    ...anchor,
    id: book.id,
    scope,
    sectionId: annotation.sectionId,
  };
}

function savedItemLabel(annotation: ReaderAnnotation) {
  if (annotation.kind === "chapter-note") return "Chapter note";
  if (annotation.kind === "note") return "Passage note";
  return "Highlight";
}
