import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Redirect, Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";

import type { BookRecord } from "@lib/ebook-core";

import type { BookScope, ReaderAnnotation } from "~/db/catalog";
import { readerAnnotationsQuery } from "~/db/catalog";
import { useColor } from "~/hooks/use-color";
import { BookCover } from "../components/book-cover";
import { useLibrary } from "../library-context";
import { BookOverviewSaved } from "./book-overview-saved";
import { BookOverviewSearch } from "./book-overview-search";

type OverviewSection = "saved" | "search";

export function BookOverviewScreen({
  id,
  scope,
}: {
  id: string;
  scope: BookScope;
}) {
  const book = useLibrary((store) =>
    (scope === "library" ? store.books : store.imports).find(
      (item) => item.id === id,
    ),
  );
  const isReady = useLibrary((store) => store.isReady);
  if (!isReady) return <OverviewLoading />;
  if (!book) return <Redirect href="/(tabs)/(library)" />;
  return <BookOverview book={book} scope={scope} />;
}

function BookOverview({ book, scope }: { book: BookRecord; scope: BookScope }) {
  const router = useRouter();
  const [section, setSection] = useState<OverviewSection>("search");
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollView = useRef<KeyboardAwareScrollViewRef>(null);
  const [annotationsQuery] = useState(() => readerAnnotationsQuery(book.id));
  const annotations = useLiveQuery(annotationsQuery).data;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: "Book overview" }} />
      <KeyboardAwareScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="px-5 pb-24 pt-4"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={(event) =>
          updateScrollToTopVisibility(event, setShowScrollToTop)
        }
        ref={scrollView}
        scrollEventThrottle={32}
      >
        <OverviewHeader book={book} scope={scope} />
        <OverviewPicker
          annotationCount={annotations.length}
          onChange={setSection}
          section={section}
        />
        <OverviewContent
          annotations={annotations}
          book={book}
          scope={scope}
          section={section}
        />
      </KeyboardAwareScrollView>
      <ScrollToTopButton
        onPress={() => scrollView.current?.scrollTo({ animated: true, y: 0 })}
        visible={showScrollToTop}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          onPress={() =>
            router.push({
              pathname: "/book/[id]/edit",
              params: { id: book.id, scope },
            })
          }
        >
          Edit
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </View>
  );
}

function OverviewContent({
  annotations,
  book,
  scope,
  section,
}: {
  annotations: ReaderAnnotation[];
  book: BookRecord;
  scope: BookScope;
  section: OverviewSection;
}) {
  if (section === "search") {
    return <BookOverviewSearch book={book} scope={scope} />;
  }
  return (
    <BookOverviewSaved annotations={annotations} book={book} scope={scope} />
  );
}

function OverviewHeader({
  book,
  scope,
}: {
  book: BookRecord;
  scope: BookScope;
}) {
  const router = useRouter();
  return (
    <View className="flex-row items-stretch gap-5">
      <View className="w-24">
        <BookCover book={book} scope={scope} />
      </View>
      <View className="min-w-0 flex-1 justify-between">
        <View>
          <Text
            className="text-foreground font-serif text-2xl leading-8"
            numberOfLines={2}
          >
            {book.title}
          </Text>
          <Text
            className="text-muted-foreground mt-1 text-sm"
            numberOfLines={2}
          >
            {book.author ?? `${book.sections.length} chapters`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          className="bg-primary mt-3 h-11 items-center justify-center rounded-full active:opacity-75"
          onPress={() =>
            router.push({
              pathname: "/book/[id]/read",
              params: { id: book.id, scope },
            })
          }
        >
          <Text className="text-primary-foreground text-sm font-semibold">
            Resume reading
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function updateScrollToTopVisibility(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  setVisible: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const visible = event.nativeEvent.contentOffset.y > 480;
  setVisible((current) => (current === visible ? current : visible));
}

function ScrollToTopButton({
  onPress,
  visible,
}: {
  onPress: () => void;
  visible: boolean;
}) {
  const background = useColor("card");
  const border = useColor("border");
  const primary = useColor("primary");
  if (!visible) return null;
  return (
    <Pressable
      accessibilityLabel="Scroll to top"
      accessibilityRole="button"
      className="absolute right-5 bottom-6 h-12 w-12 items-center justify-center rounded-full border active:opacity-70"
      onPress={onPress}
      style={{ backgroundColor: background, borderColor: border }}
    >
      <SymbolView
        name="arrow.up"
        size={18}
        tintColor={primary}
        weight="semibold"
      />
    </Pressable>
  );
}

function OverviewPicker({
  annotationCount,
  onChange,
  section,
}: {
  annotationCount: number;
  onChange: (section: OverviewSection) => void;
  section: OverviewSection;
}) {
  return (
    <View className="bg-muted mt-7 flex-row rounded-xl p-1">
      <SectionButton
        active={section === "search"}
        label="Search book"
        onPress={() => onChange("search")}
      />
      <SectionButton
        active={section === "saved"}
        label={`Saved · ${annotationCount}`}
        onPress={() => onChange("saved")}
      />
    </View>
  );
}

function SectionButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`h-10 flex-1 items-center justify-center rounded-lg ${active ? "bg-card" : ""}`}
      onPress={onPress}
    >
      <Text
        className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function OverviewLoading() {
  const primary = useColor("primary");
  return (
    <View className="bg-background flex-1 items-center justify-center">
      <ActivityIndicator color={primary} />
    </View>
  );
}
