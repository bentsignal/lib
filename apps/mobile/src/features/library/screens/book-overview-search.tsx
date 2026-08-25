import { useDeferredValue, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { BookRecord } from "@lib/ebook-core";

import type { BookSearchResult } from "../book-search";
import type { BookScope } from "~/db/catalog";
import { findBookTextResults } from "../book-search";
import {
  getBookSearchDocuments,
  sectionForSearchPosition,
} from "../book-search-documents";
import { OverviewEmptyMessage, OverviewSearchField } from "./book-overview-ui";

export function BookOverviewSearch({
  book,
  scope,
}: {
  book: BookRecord;
  scope: BookScope;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim();
  const index = useSearchIndex(book, scope, normalizedQuery.length > 0);
  const results = findBookTextResults(index.documents, deferredQuery);
  return (
    <View className="mt-6">
      <OverviewSearchField
        label="Search all book text"
        onChange={setQuery}
        placeholder="Find a word or passage"
        value={query}
      />
      <SearchResults
        book={book}
        error={index.error}
        loading={index.loading}
        query={normalizedQuery}
        results={results}
        scope={scope}
      />
    </View>
  );
}

function useSearchIndex(book: BookRecord, scope: BookScope, enabled: boolean) {
  const key = `${scope}:${book.id}:${book.modifiedAt}`;
  const [state, setState] = useState<{
    documents: Awaited<ReturnType<typeof getBookSearchDocuments>>;
    error: boolean;
    key: string;
  }>({ documents: [], error: false, key: "" });

  // eslint-disable-next-line no-restricted-syntax -- A query resolves the shared persistent index or joins its background build.
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getBookSearchDocuments(book, scope)
      .then((documents) => {
        if (active) setState({ documents, error: false, key });
      })
      .catch(() => {
        if (active) setState({ documents: [], error: true, key });
      });
    return () => {
      active = false;
    };
  }, [book, enabled, key, scope]);

  const current = state.key === key;
  return {
    documents: current ? state.documents : [],
    error: enabled && current && state.error,
    loading: enabled && !current,
  };
}

function SearchResults({
  book,
  error,
  loading,
  query,
  results,
  scope,
}: {
  book: BookRecord;
  error: boolean;
  loading: boolean;
  query: string;
  results: BookSearchResult[];
  scope: BookScope;
}) {
  if (!query) {
    return <OverviewEmptyMessage text="Search for any passage from the book" />;
  }
  if (loading) return <SearchLoading />;
  if (error) {
    return <OverviewEmptyMessage text="This book couldn’t be searched" />;
  }
  if (results.length === 0) {
    return <OverviewEmptyMessage text="No matches in this book" />;
  }
  return (
    <View>
      <Text className="text-muted-foreground mt-3 mb-1 text-xs">
        {resultSummary(results.length)}
      </Text>
      {results.slice(0, 80).map((result, index) => (
        <BookSearchResultRow
          book={book}
          key={`${result.position}:${result.occurrence}:${index}`}
          query={query}
          result={result}
          scope={scope}
        />
      ))}
    </View>
  );
}

function SearchLoading() {
  return (
    <View className="items-center py-10">
      <ActivityIndicator />
      <Text className="text-muted-foreground mt-3 text-sm">
        Indexing this book…
      </Text>
    </View>
  );
}

function BookSearchResultRow({
  book,
  query,
  result,
  scope,
}: {
  book: BookRecord;
  query: string;
  result: BookSearchResult;
  scope: BookScope;
}) {
  const router = useRouter();
  const section = sectionForSearchPosition(book, result.position);
  if (!section) return null;
  const locationLabel =
    book.format === "pdf" ? `Page ${result.position}` : section.title;
  const destination =
    book.format === "pdf"
      ? { page: result.position }
      : {
          location: result.position,
          occurrence: result.occurrence,
          query,
          sectionId: section.id,
        };
  return (
    <Pressable
      accessibilityRole="button"
      className="border-border bg-card mt-3 rounded-2xl border p-4 active:opacity-75"
      onPress={() =>
        router.push({
          pathname: "/book/[id]/read",
          params: { id: book.id, scope, ...destination },
        })
      }
    >
      <Text className="text-primary text-xs font-semibold tracking-wide uppercase">
        {locationLabel}
      </Text>
      <Text className="text-foreground mt-2 text-[15px] leading-6">
        {result.snippet}
      </Text>
    </Pressable>
  );
}

function resultSummary(count: number) {
  const matches = `${count} ${count === 1 ? "match" : "matches"}`;
  return count > 80 ? `${matches} · showing first 80` : matches;
}
