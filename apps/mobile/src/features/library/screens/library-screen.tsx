import type { ViewToken } from "react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";

import type { BookRecord } from "@lib/ebook-core";

import type { ReaderTheme } from "../epub-reader-cache";
import { getReadingActivity } from "~/db/catalog";
import { useColor } from "~/hooks/use-color";
import {
  getBookOpenActivity,
  subscribeToBookOpenActivity,
} from "../book-recency";
import { BookCover } from "../components/book-cover";
import {
  cancelScheduledEpubPreloads,
  scheduleVisibleEpubPreloads,
} from "../epub-reader-cache";
import { useLibrary } from "../library-context";
import { libraryTopPadding, sortBooksByRecentOpen } from "../library-order";

export function LibraryScreen() {
  const books = useLibrary((store) => store.books);
  const [readingActivity, setReadingActivity] = useState(() =>
    getBookOpenActivity(getReadingActivity()),
  );
  const [orderVersion, setOrderVersion] = useState(0);
  const isReady = useLibrary((store) => store.isReady);
  const insets = useSafeAreaInsets();
  const background = useColor("background");
  const foreground = useColor("foreground");
  const muted = useColor("border");
  const readerTheme = { background, foreground, muted };
  const orderedBooks = sortBooksByRecentOpen(books, readingActivity);
  // eslint-disable-next-line no-restricted-syntax -- The hidden Library updates as soon as a reader records activity, before the user navigates back.
  useEffect(
    () =>
      subscribeToBookOpenActivity(() => {
        setReadingActivity(getBookOpenActivity(getReadingActivity()));
        setOrderVersion((version) => version + 1);
      }),
    [],
  );
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <LibraryContent
        books={orderedBooks}
        isReady={isReady}
        orderVersion={orderVersion}
        readerTheme={readerTheme}
        topInset={insets.top}
      />
    </View>
  );
}

function LibraryContent({
  books,
  isReady,
  orderVersion,
  readerTheme,
  topInset,
}: {
  books: BookRecord[];
  isReady: boolean;
  orderVersion: number;
  readerTheme: ReaderTheme;
  topInset: number;
}) {
  const list = useRef<FlatList<BookRecord>>(null);
  const themeKey = `${readerTheme.background}:${readerTheme.foreground}:${readerTheme.muted}`;

  // eslint-disable-next-line no-restricted-syntax -- Reset the already-hidden shelf before its newly opened book is presented at the top on return.
  useEffect(() => {
    if (orderVersion === 0) return;
    const frame = requestAnimationFrame(() =>
      list.current?.scrollToOffset({
        animated: false,
        offset: 0,
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [orderVersion, topInset]);

  function onViewableItemsChanged({
    viewableItems,
  }: {
    viewableItems: ViewToken<BookRecord>[];
  }) {
    scheduleVisibleEpubPreloads(
      viewableItems
        .filter((token) => token.isViewable)
        .map((token) => token.item),
      readerTheme,
    );
  }

  useFocusEffect(function cancelPreloadsWhenLibraryBlurs() {
    return cancelScheduledEpubPreloads;
  });

  if (isReady && books.length === 0) {
    return <EmptyLibrary />;
  }
  return (
    <FlatList
      ref={list}
      contentInsetAdjustmentBehavior="never"
      columnWrapperClassName="gap-4"
      contentContainerClassName="gap-7 px-5 pb-32"
      contentContainerStyle={{ paddingTop: libraryTopPadding(topInset) }}
      data={books}
      key={themeKey}
      keyExtractor={({ id }) => id}
      numColumns={2}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => <BookTile book={item} />}
      showsVerticalScrollIndicator={false}
      viewabilityConfig={libraryViewabilityConfig}
    />
  );
}

const libraryViewabilityConfig = { itemVisiblePercentThreshold: 20 };

export function BookTile({ book }: { book: BookRecord }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel={`${book.title}, ${book.author ?? book.format}`}
      accessibilityRole="button"
      className="min-w-0 active:opacity-70"
      onPress={() =>
        router.push({
          pathname: "/book/[id]/read",
          params: { id: book.id },
        })
      }
      style={{ width: "47%" }}
    >
      <BookCover book={book} />
      <Text
        className="text-foreground mt-3 text-[15px] font-semibold"
        numberOfLines={1}
      >
        {book.title}
      </Text>
      <Text
        className="text-muted-foreground mt-0.5 text-[13px]"
        numberOfLines={1}
      >
        {book.author ?? `${book.sections.length} sections`}
      </Text>
    </Pressable>
  );
}

function EmptyLibrary() {
  const primary = useColor("primary");

  return (
    <View className="flex-1 items-center justify-center px-10">
      <View className="mb-3 items-center justify-center">
        <SymbolView
          fallback={<Text className="text-primary text-4xl">+</Text>}
          name="books.vertical.fill"
          size={48}
          tintColor={primary}
          type="hierarchical"
        />
      </View>
      <Text className="text-foreground font-serif text-3xl">
        Your shelf is empty
      </Text>
      <Text className="text-muted-foreground mt-2 text-center text-[15px] leading-6">
        Use the Import tab to bring in books.
      </Text>
    </View>
  );
}
