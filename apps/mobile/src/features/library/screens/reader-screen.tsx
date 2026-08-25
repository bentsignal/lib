// eslint-disable-next-line no-restricted-imports -- Included chapters must remain referentially stable while progress rows update reactively.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Crypto from "expo-crypto";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";

import type { BookRecord } from "@lib/ebook-core";

import type { ReaderSelectionMessage } from "../reader-annotations";
import type {
  BookScope,
  ReaderAnnotation,
  ReadingProgress,
} from "~/db/catalog";
import {
  addChapterNote,
  addReaderAnnotation,
  deleteReaderAnnotation,
  deleteReaderHighlightsInRange,
  getReadingProgress,
  readerAnnotationsQuery,
  removeDuplicateReaderAnnotations,
  saveReadingProgress,
  updateReaderAnnotationNote,
} from "~/db/catalog";
import { useColor } from "~/hooks/use-color";
import { getPdfPageCountAsync, LibPdfView } from "~/native/lib-pdf";
import { recordBookOpened } from "../book-recency";
import { AnnotationBrowserModal } from "../components/annotation-browser-modal";
import { AnnotationNoteModal } from "../components/annotation-note-modal";
import { ChapterBrowserModal } from "../components/chapter-browser-modal";
import { ChapterControlsPanel } from "../components/chapter-controls-panel";
import { ReaderSecondaryActions } from "../components/reader-secondary-actions";
import { chapterWindowIndices } from "../epub-navigation";
import {
  getReaderDocument,
  getResolvedReaderDocument,
  readerDocumentKey,
  readerThemeKey,
} from "../epub-reader-cache";
import { useLibrary } from "../library-context";
import { getSourceFile } from "../library-storage";
import {
  applyReaderAnnotationsScript,
  parseReaderAnnotationEvent,
  readerSelectionObserverScript,
  readerSelectionScript,
  scrollToReaderSearchResultScript,
} from "../reader-annotations";
import { chatGptAppUrl, chatGptDraftUrl } from "../reader-chatgpt";
import {
  parseReaderChromeEvent,
  readerChromePressScript,
  readerChromeScrollScript,
} from "../reader-chrome";
import {
  EPUB_RESTORE_COMPLETE_MESSAGE,
  epubScrollRestoreScript,
  resolveEpubPosition,
} from "../reader-progress";

/* eslint-disable max-lines */

export interface ReaderDestination {
  annotationId?: string;
  location?: number;
  occurrence?: number;
  page?: number;
  query?: string;
  sectionId?: string;
}

export function ReaderScreen({
  destination,
  id,
  scope,
}: {
  destination?: ReaderDestination;
  id: string;
  scope: BookScope;
}) {
  const book = useLibrary((store) =>
    (scope === "library" ? store.books : store.imports).find(
      (item) => item.id === id,
    ),
  );
  const isReady = useLibrary((store) => store.isReady);
  const primary = useColor("primary");
  const [chromeVisible, setChromeVisible] = useState(true);
  if (!isReady) return <ReaderLoading color={primary} />;
  if (!book) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Text className="text-muted-foreground">Book not found.</Text>
      </View>
    );
  }
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerLargeTitle: false,
          headerShown: chromeVisible,
          title: book.title,
        }}
      />
      <BookReader
        book={book}
        chromeVisible={chromeVisible}
        destination={destination}
        key={`${scope}:${book.id}`}
        onToggleChrome={() => setChromeVisible((visible) => !visible)}
        scope={scope}
      />
    </View>
  );
}

function BookReader({
  book,
  chromeVisible,
  destination,
  onToggleChrome,
  scope,
}: {
  book: BookRecord;
  chromeVisible: boolean;
  destination?: ReaderDestination;
  onToggleChrome: () => void;
  scope: BookScope;
}) {
  const [progress] = useState(() =>
    scope === "library" ? getReadingProgress(book.id) : undefined,
  );
  // eslint-disable-next-line no-restricted-syntax -- Let the native push finish before the hidden Library reorders and resets its scroll position.
  useEffect(() => {
    if (scope !== "library") return;
    const timer = setTimeout(() => recordBookOpened(book.id), 400);
    return () => clearTimeout(timer);
  }, [book.id, scope]);
  if (book.format === "pdf") {
    return (
      <PdfReader
        book={book}
        destination={destination}
        progress={progress}
        scope={scope}
      />
    );
  }
  return (
    <EpubReader
      book={book}
      chromeVisible={chromeVisible}
      destination={destination}
      onToggleChrome={onToggleChrome}
      progress={progress}
      scope={scope}
    />
  );
}

// eslint-disable-next-line complexity, max-lines-per-function -- PDF controls coordinate native readiness, progress, navigation, and chapter-note state.
function PdfReader({
  book,
  destination,
  progress,
  scope,
}: {
  book: BookRecord;
  destination?: ReaderDestination;
  progress: ReadingProgress | undefined;
  scope: BookScope;
}) {
  const sourceUri = getSourceFile(book, scope).uri;
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string>();
  const [pageNumber, setPageNumber] = useState(
    destination?.page ?? progress?.pdfPage ?? 1,
  );
  const [initialPage] = useState(destination?.page ?? progress?.pdfPage ?? 1);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(false);
  const [chapterNoteDraft, setChapterNoteDraft] = useState<string>();
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<ReaderAnnotation>();
  const noteSection = pdfSectionAtPage(book, pageNumber);
  const annotationQuery = useMemo(
    () => readerAnnotationsQuery(book.id),
    [book.id],
  );
  const annotations = useLiveQuery(annotationQuery).data;
  const chapterAnnotations = annotations.filter(
    (annotation) => annotation.sectionId === noteSection?.id,
  );

  // eslint-disable-next-line no-restricted-syntax -- PDFKit readiness is an external native reader lifecycle.
  useEffect(() => {
    let cancelled = false;
    void getPdfPageCountAsync(sourceUri)
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [sourceUri]);

  if (error) return <ReaderError format="PDF" message={error} />;
  return (
    <View className="flex-1">
      <PdfDocument
        bookId={book.id}
        initialPage={initialPage}
        isReady={isReady}
        onPageChange={setPageNumber}
        scope={scope}
        sourceUri={sourceUri}
      />
      <ReaderControls
        book={book}
        expanded={controlsExpanded}
        onExpandedChange={setControlsExpanded}
        scope={scope}
        detail={`Page ${pageNumber} of ${book.pageCount ?? 1}`}
        annotationCount={chapterAnnotations.length}
        onShowAnnotations={
          scope === "library" && noteSection
            ? () => setAnnotationsVisible(true)
            : undefined
        }
      />
      <AnnotationBrowserModal
        annotations={chapterAnnotations}
        onAddNote={() => {
          setAnnotationsVisible(false);
          if (noteSection) setChapterNoteDraft(noteSection.title);
        }}
        onClose={() => setAnnotationsVisible(false)}
        onSelect={(annotation) => {
          setAnnotationsVisible(false);
          setSelectedAnnotation(annotation);
        }}
        visible={annotationsVisible}
      />
      <AnnotationNoteModal
        annotation={selectedAnnotation}
        chapterDraft={chapterNoteDraft}
        context={noteSection?.title}
        onClose={() => {
          setChapterNoteDraft(undefined);
          setSelectedAnnotation(undefined);
        }}
        onDelete={(id) => {
          deleteReaderAnnotation(id);
          setSelectedAnnotation(undefined);
        }}
        onSave={(note) => {
          if (noteSection) {
            addChapterNote({
              bookId: book.id,
              id: Crypto.randomUUID(),
              note,
              sectionId: noteSection.id,
            });
          }
          setChapterNoteDraft(undefined);
        }}
        onUpdate={(id, note) => {
          updateReaderAnnotationNote(id, note);
          setSelectedAnnotation(undefined);
        }}
      />
    </View>
  );
}

function PdfDocument({
  bookId,
  initialPage,
  isReady,
  onPageChange,
  scope,
  sourceUri,
}: {
  bookId: string;
  initialPage: number;
  isReady: boolean;
  onPageChange: (page: number) => void;
  scope: BookScope;
  sourceUri: string;
}) {
  if (!isReady) return <View className="bg-background flex-1" />;
  return (
    <View className="bg-background flex-1">
      <ReaderDocumentLayer active revealed>
        <LibPdfView
          onPageChange={({ nativeEvent }) => {
            onPageChange(nativeEvent.pageNumber);
            if (scope === "library") {
              void saveReadingProgress(bookId, {
                pdfPage: nativeEvent.pageNumber,
              });
            }
          }}
          pageNumber={initialPage}
          sourceUri={sourceUri}
          style={{ flex: 1 }}
        />
      </ReaderDocumentLayer>
    </View>
  );
}

// eslint-disable-next-line complexity, max-lines-per-function -- Reader state intentionally stays together to coordinate WebView restoration, caching, navigation, and durable progress.
function EpubReader({
  book,
  chromeVisible,
  destination,
  onToggleChrome,
  progress: savedProgress,
  scope,
}: {
  book: BookRecord;
  chromeVisible: boolean;
  destination?: ReaderDestination;
  onToggleChrome: () => void;
  progress: ReadingProgress | undefined;
  scope: BookScope;
}) {
  const background = useColor("background");
  const foreground = useColor("foreground");
  const muted = useColor("border");
  const sourceUri = getSourceFile(book, scope).uri;
  const sections = useMemo(
    () => book.sections.filter((section) => section.included),
    [book.sections],
  );
  const destinationSectionIndex = sections.findIndex(
    (item) => item.id === destination?.sectionId,
  );
  const initialPosition =
    destinationSectionIndex >= 0
      ? { scrollProgress: 0, sectionIndex: destinationSectionIndex }
      : resolveEpubPosition(sections, savedProgress);
  const [sectionIndex, setSectionIndex] = useState(
    initialPosition.sectionIndex,
  );
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState(
    Math.round(initialPosition.scrollProgress * 100),
  );
  const [restoreProgress, setRestoreProgress] = useState(
    initialPosition.scrollProgress,
  );
  const [revealedDocuments, setRevealedDocuments] = useState(
    () => new Set<string>(),
  );
  const [canMountDocuments, setCanMountDocuments] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [chaptersVisible, setChaptersVisible] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState<ReaderSelectionMessage>();
  const [chapterNoteDraft, setChapterNoteDraft] = useState<string>();
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<ReaderAnnotation>();
  const [selectionHasHighlight, setSelectionHasHighlight] = useState(false);
  const [chatGptAvailable, setChatGptAvailable] = useState(false);
  const [pendingSectionIndex, setPendingSectionIndex] = useState<number>();
  const section = sections[sectionIndex];
  const sectionProgress = useRef(new Map<string, number>());
  const readerViewport = useRef<View>(null);
  const webViews = useRef(new Map<string, WebView>());
  const loadedDocuments = useRef(new Set<string>());
  const pendingNavigation = useRef<{ index: number; key: string } | null>(null);
  const pendingAnnotationId = useRef(destination?.annotationId);
  const pendingSearchTarget = useRef(
    destination?.location !== undefined &&
      destination.query &&
      destination.occurrence !== undefined
      ? {
          locationIndex: destination.location - 1,
          occurrence: destination.occurrence,
          query: destination.query,
        }
      : undefined,
  );
  const pendingChromeAnchor = useRef<{
    documentKey: string;
    scrollOffset: number;
    viewportY: number;
  } | null>(null);
  const latestScrollOffset = useRef(0);
  const isRestoring = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const latestProgress = useRef({
    scrollProgress: initialPosition.scrollProgress,
    sectionId: section?.id,
    sectionIndex: initialPosition.sectionIndex,
  });
  const themeKey = readerThemeKey({ background, foreground, muted });
  const documentKey = readerDocumentKey(book, scope, section?.id, themeKey);
  const annotationQuery = useMemo(
    () => readerAnnotationsQuery(book.id),
    [book.id],
  );
  const annotations = useLiveQuery(annotationQuery).data;
  const chapterAnnotations = annotations.filter(
    (annotation) => annotation.sectionId === section?.id,
  );

  // eslint-disable-next-line no-restricted-syntax -- Let the native route transition begin before mounting the comparatively expensive WebView tree.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setCanMountDocuments(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // eslint-disable-next-line no-restricted-syntax -- Existing installs may contain duplicate annotations created before range deduplication.
  useEffect(() => {
    if (scope === "library") removeDuplicateReaderAnnotations(book.id);
  }, [book.id, scope]);

  // eslint-disable-next-line no-restricted-syntax -- ChatGPT is an optional external iOS app whose availability can change between installs.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    void Linking.canOpenURL(chatGptAppUrl())
      .then((available) => {
        if (!cancelled) setChatGptAvailable(available);
      })
      .catch(() => {
        if (!cancelled) setChatGptAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const renderedIndices = useMemo(
    () =>
      chapterWindowIndices(sectionIndex, sections.length, pendingSectionIndex),
    [pendingSectionIndex, sectionIndex, sections.length],
  );
  const mountedIndices = canMountDocuments ? renderedIndices : [];

  // eslint-disable-next-line no-restricted-syntax -- EPUB rendering synchronizes an external archive session with the visible and prepared sections.
  useEffect(() => {
    if (!section) return;
    let cancelled = false;
    for (const index of renderedIndices) {
      const renderedSection = sections[index];
      if (!renderedSection) continue;
      const key = readerDocumentKey(book, scope, renderedSection.id, themeKey);
      const cached = getResolvedReaderDocument(key);
      if (cached) continue;
      void getReaderDocument({
        book,
        section: renderedSection,
        scope,
        sourceUri,
        theme: { background, foreground, muted },
        themeKey,
      })
        .then((html) => {
          if (!cancelled) {
            setDocuments((current) => addDocument(current, key, html));
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) setError(errorMessage(reason));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    background,
    book,
    documentKey,
    foreground,
    muted,
    scope,
    section,
    sectionIndex,
    sections,
    sourceUri,
    themeKey,
    renderedIndices,
  ]);

  // eslint-disable-next-line no-restricted-syntax -- A prepared WebView receives its saved position as soon as it becomes active.
  useEffect(() => {
    if (!loadedDocuments.current.has(documentKey)) return;
    isRestoring.current = true;
    const frame = requestAnimationFrame(() => {
      webViews.current
        .get(documentKey)
        ?.injectJavaScript(epubScrollRestoreScript(restoreProgress));
    });
    return () => cancelAnimationFrame(frame);
  }, [documentKey, restoreProgress]);

  // eslint-disable-next-line no-restricted-syntax -- Persisted annotations are painted into every prepared chapter without rebuilding its EPUB document.
  useEffect(() => {
    for (const index of renderedIndices) {
      const renderedSection = sections[index];
      if (!renderedSection) continue;
      const key = readerDocumentKey(book, scope, renderedSection.id, themeKey);
      if (!loadedDocuments.current.has(key)) continue;
      webViews.current
        .get(key)
        ?.injectJavaScript(
          applyReaderAnnotationsScript(
            annotations.filter(
              (annotation) => annotation.sectionId === renderedSection.id,
            ),
          ),
        );
    }
  }, [annotations, book, renderedIndices, scope, sections, themeKey]);

  // eslint-disable-next-line no-restricted-syntax -- Unmount cleanup flushes the last external reader position to SQLite.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (scope === "library") {
        saveReadingProgress(book.id, latestProgress.current);
      }
    },
    [book.id, scope],
  );

  if (error) return <ReaderError format="EPUB" message={error} />;
  if (!section) {
    return <ReaderError format="EPUB" message="No chapters are included." />;
  }
  return (
    <View className="flex-1">
      <View
        className="flex-1"
        onLayout={restoreChromeScrollAnchor}
        ref={readerViewport}
      >
        {/* eslint-disable-next-line complexity, max-lines-per-function -- Each prepared WebView owns its native lifecycle callbacks. */}
        {mountedIndices.map((index) => {
          const renderedSection = sections[index];
          if (!renderedSection) return null;
          const key = readerDocumentKey(
            book,
            scope,
            renderedSection.id,
            themeKey,
          );
          const html = documents[key] ?? getResolvedReaderDocument(key);
          if (!html) return null;
          const active = index === sectionIndex;
          return (
            <ReaderDocumentLayer
              accessibilityElementsHidden={!active}
              active={active}
              importantForAccessibility={
                active ? "auto" : "no-hide-descendants"
              }
              key={key}
              pointerEvents={active ? "auto" : "none"}
              revealed={revealedDocuments.has(key)}
            >
              <WebView
                ref={(instance) => {
                  if (instance) webViews.current.set(key, instance);
                  else webViews.current.delete(key);
                }}
                allowFileAccess={false}
                allowsLinkPreview={false}
                bounces
                containerStyle={{ backgroundColor: background }}
                decelerationRate="normal"
                javaScriptEnabled
                onLoadEnd={() => {
                  loadedDocuments.current.add(key);
                  webViews.current
                    .get(key)
                    ?.injectJavaScript(readerSelectionObserverScript());
                  webViews.current
                    .get(key)
                    ?.injectJavaScript(readerChromePressScript());
                  webViews.current
                    .get(key)
                    ?.injectJavaScript(
                      applyReaderAnnotationsScript(
                        annotations.filter(
                          (annotation) =>
                            annotation.sectionId === renderedSection.id,
                        ),
                      ),
                    );
                  const saved = active
                    ? restoreProgress
                    : (sectionProgress.current.get(renderedSection.id) ?? 0);
                  webViews.current
                    .get(key)
                    ?.injectJavaScript(epubScrollRestoreScript(saved));
                  const pending = pendingNavigation.current;
                  if (pending?.key === key) {
                    commitSectionChange(pending.index);
                  }
                }}
                onLoadStart={() => {
                  if (active) isRestoring.current = true;
                }}
                // eslint-disable-next-line complexity -- One native message channel coordinates restore, selection, and annotation events.
                onMessage={({ nativeEvent }) => {
                  if (
                    active &&
                    nativeEvent.data === EPUB_RESTORE_COMPLETE_MESSAGE
                  ) {
                    isRestoring.current = false;
                    setRevealedDocuments((current) => addKey(current, key));
                    const annotationId = pendingAnnotationId.current;
                    if (annotationId) {
                      pendingAnnotationId.current = undefined;
                      webViews.current.get(key)?.injectJavaScript(
                        applyReaderAnnotationsScript(
                          annotations.filter(
                            (annotation) =>
                              annotation.sectionId === renderedSection.id,
                          ),
                          annotationId,
                        ),
                      );
                    }
                    const searchTarget = pendingSearchTarget.current;
                    if (searchTarget) {
                      pendingSearchTarget.current = undefined;
                      webViews.current
                        .get(key)
                        ?.injectJavaScript(
                          scrollToReaderSearchResultScript(searchTarget),
                        );
                    }
                    return;
                  }
                  if (active && parseReaderChromeEvent(nativeEvent.data)) {
                    setControlsExpanded(false);
                    toggleChrome();
                    return;
                  }
                  const event = parseReaderAnnotationEvent(nativeEvent.data);
                  if (!active || !event) return;
                  if (event.type === "annotation-press") {
                    if (scope !== "library") return;
                    const annotation = annotations.find(
                      (item) => item.id === event.id,
                    );
                    if (annotation?.kind === "note") {
                      setSelectedAnnotation(annotation);
                    }
                    return;
                  }
                  if (event.type === "selection-state") {
                    setSelectionHasHighlight(event.hasHighlight);
                    return;
                  }
                  if (!event.selectedText.trim()) return;
                  if (event.action === "chatgpt") {
                    void Linking.openURL(
                      chatGptDraftUrl({
                        author: book.author,
                        selectedText: event.selectedText,
                        title: book.title,
                      }),
                    ).catch(() => setChatGptAvailable(false));
                    return;
                  }
                  if (scope !== "library") return;
                  if (event.action === "unhighlight") {
                    deleteReaderHighlightsInRange({
                      bookId: book.id,
                      endOffset: event.endOffset,
                      sectionId: renderedSection.id,
                      startOffset: event.startOffset,
                    });
                    return;
                  }
                  if (event.action === "note") {
                    setNoteDraft(event);
                    return;
                  }
                  saveAnnotation(event, "highlight");
                }}
                menuItems={
                  active && (scope === "library" || chatGptAvailable)
                    ? [
                        ...(scope === "library"
                          ? [
                              { key: "libHighlight", label: "Highlight" },
                              { key: "libNote", label: "Add Note" },
                            ]
                          : []),
                        ...(chatGptAvailable
                          ? [{ key: "libChatGPT", label: "Ask ChatGPT" }]
                          : []),
                        ...(selectionHasHighlight
                          ? [
                              {
                                key: "libUnhighlight",
                                label: "Remove Highlight",
                              },
                            ]
                          : []),
                      ]
                    : undefined
                }
                onCustomMenuSelection={({ nativeEvent }) => {
                  const action = customMenuAction(nativeEvent.key);
                  webViews.current
                    .get(key)
                    ?.injectJavaScript(readerSelectionScript(action));
                }}
                onScroll={({ nativeEvent }) => {
                  if (!active) return;
                  latestScrollOffset.current = nativeEvent.contentOffset.y;
                  const maximum =
                    nativeEvent.contentSize.height -
                    nativeEvent.layoutMeasurement.height;
                  if (maximum <= 0 || isRestoring.current) return;
                  const next = Math.max(
                    0,
                    Math.min(1, nativeEvent.contentOffset.y / maximum),
                  );
                  sectionProgress.current.set(renderedSection.id, next);
                  latestProgress.current = {
                    scrollProgress: next,
                    sectionId: renderedSection.id,
                    sectionIndex: index,
                  };
                  setProgress(Math.round(next * 100));
                  if (scope !== "library") return;
                  if (saveTimer.current) clearTimeout(saveTimer.current);
                  saveTimer.current = setTimeout(() => {
                    saveReadingProgress(book.id, {
                      scrollProgress: next,
                      sectionId: renderedSection.id,
                      sectionIndex: index,
                    });
                  }, 350);
                }}
                onShouldStartLoadWithRequest={({ url }) =>
                  url.startsWith("about:blank")
                }
                originWhitelist={["about:blank"]}
                scrollEnabled={active}
                setSupportMultipleWindows={false}
                source={{ html }}
                style={{ backgroundColor: background }}
                textInteractionEnabled={active}
              />
            </ReaderDocumentLayer>
          );
        })}
      </View>
      <ReaderControls
        book={book}
        expanded={controlsExpanded}
        header={
          <EpubNavigation
            count={sections.length}
            index={sectionIndex}
            onChange={prepareSectionChange}
            progress={progress}
            title={section.title}
            onToggle={() => setControlsExpanded(!controlsExpanded)}
          />
        }
        onExpandedChange={setControlsExpanded}
        onShowChapters={() => setChaptersVisible(true)}
        annotationCount={chapterAnnotations.length}
        onShowAnnotations={
          scope === "library" ? () => setAnnotationsVisible(true) : undefined
        }
        scope={scope}
        visible={chromeVisible}
      />
      <ChapterBrowserModal
        currentIndex={sectionIndex}
        onClose={() => setChaptersVisible(false)}
        onSelect={(index) => {
          setChaptersVisible(false);
          setControlsExpanded(false);
          prepareSectionChange(index);
        }}
        sections={sections}
        visible={chaptersVisible}
      />
      <AnnotationBrowserModal
        annotations={chapterAnnotations}
        onAddNote={() => {
          setAnnotationsVisible(false);
          setChapterNoteDraft(section.title);
        }}
        onClose={() => setAnnotationsVisible(false)}
        onSelect={(annotation) => {
          setAnnotationsVisible(false);
          setControlsExpanded(false);
          if (annotation.kind === "chapter-note") {
            setSelectedAnnotation(annotation);
            return;
          }
          pendingAnnotationId.current = annotation.id;
          const index = sections.findIndex(
            (item) => item.id === annotation.sectionId,
          );
          if (index === sectionIndex) {
            pendingAnnotationId.current = undefined;
            webViews.current
              .get(documentKey)
              ?.injectJavaScript(
                applyReaderAnnotationsScript(chapterAnnotations, annotation.id),
              );
          } else {
            prepareSectionChange(index);
          }
        }}
        visible={annotationsVisible}
      />
      <AnnotationNoteModal
        annotation={selectedAnnotation}
        chapterDraft={chapterNoteDraft}
        context={section.title}
        draft={noteDraft}
        onClose={() => {
          setNoteDraft(undefined);
          setChapterNoteDraft(undefined);
          setSelectedAnnotation(undefined);
        }}
        onDelete={(id) => {
          deleteReaderAnnotation(id);
          setSelectedAnnotation(undefined);
        }}
        onSave={(note) => {
          if (noteDraft) saveAnnotation(noteDraft, "note", note);
          if (chapterNoteDraft) {
            addChapterNote({
              bookId: book.id,
              id: Crypto.randomUUID(),
              note,
              sectionId: section.id,
            });
          }
          setNoteDraft(undefined);
          setChapterNoteDraft(undefined);
        }}
        onUpdate={(id, note) => {
          updateReaderAnnotationNote(id, note);
          setSelectedAnnotation(undefined);
        }}
      />
    </View>
  );

  function prepareSectionChange(index: number) {
    const nextSection = sections[index];
    if (!nextSection || index === sectionIndex) return;
    const key = readerDocumentKey(book, scope, nextSection.id, themeKey);
    if (loadedDocuments.current.has(key)) {
      commitSectionChange(index);
      return;
    }
    pendingNavigation.current = { index, key };
    setPendingSectionIndex(index);
  }

  function toggleChrome() {
    const viewport = readerViewport.current;
    if (!viewport) {
      onToggleChrome();
      return;
    }
    viewport.measureInWindow((_x, viewportY) => {
      pendingChromeAnchor.current = {
        documentKey,
        scrollOffset: latestScrollOffset.current,
        viewportY,
      };
      onToggleChrome();
    });
  }

  function restoreChromeScrollAnchor() {
    const anchor = pendingChromeAnchor.current;
    const viewport = readerViewport.current;
    if (!anchor || !viewport) return;
    requestAnimationFrame(() => {
      viewport.measureInWindow((_x, viewportY) => {
        if (pendingChromeAnchor.current !== anchor) return;
        pendingChromeAnchor.current = null;
        const offset = anchor.scrollOffset + viewportY - anchor.viewportY;
        latestScrollOffset.current = Math.max(0, offset);
        webViews.current
          .get(anchor.documentKey)
          ?.injectJavaScript(readerChromeScrollScript(offset));
      });
    });
  }

  function commitSectionChange(index: number) {
    const nextSection = sections[index];
    if (!nextSection) return;
    const nextProgress = sectionProgress.current.get(nextSection.id) ?? 0;
    setProgress(Math.round(nextProgress * 100));
    isRestoring.current = true;
    setRestoreProgress(nextProgress);
    setSectionIndex(index);
    setSelectionHasHighlight(false);
    setPendingSectionIndex(undefined);
    pendingNavigation.current = null;
    latestProgress.current = {
      scrollProgress: nextProgress,
      sectionId: nextSection.id,
      sectionIndex: index,
    };
    if (scope === "library") {
      saveReadingProgress(book.id, {
        scrollProgress: nextProgress,
        sectionId: nextSection.id,
        sectionIndex: index,
      });
    }
  }

  function saveAnnotation(
    selection: ReaderSelectionMessage,
    kind: "highlight" | "note",
    note?: string,
  ) {
    if (!section) return;
    const id = addReaderAnnotation({
      bookId: book.id,
      endOffset: selection.endOffset,
      id: Crypto.randomUUID(),
      kind,
      note,
      sectionId: section.id,
      selectedText: selection.selectedText.trim(),
      startOffset: selection.startOffset,
    });
    if (kind === "note" && note) updateReaderAnnotationNote(id, note);
  }
}

function ReaderControls({
  annotationCount,
  book,
  detail,
  expanded,
  header,
  onExpandedChange,
  onShowAnnotations,
  onShowChapters,
  scope,
  visible = true,
}: {
  book: BookRecord;
  annotationCount?: number;
  detail?: string;
  expanded: boolean;
  header?: React.ReactNode;
  onExpandedChange: (expanded: boolean) => void;
  onShowAnnotations?: () => void;
  onShowChapters?: () => void;
  scope: BookScope;
  visible?: boolean;
}) {
  const router = useRouter();
  if (!visible) return null;

  return (
    <ChapterControlsPanel
      expanded={expanded}
      header={header}
      onExpandedChange={onExpandedChange}
    >
      <ReaderDetail text={detail} />
      <ReaderSecondaryActions
        annotationCount={annotationCount}
        onShowAnnotations={onShowAnnotations}
        onShowChapters={onShowChapters}
        onShowOverview={() =>
          router.push({
            pathname: "/book/[id]/overview",
            params: { id: book.id, scope },
          })
        }
      />
    </ChapterControlsPanel>
  );
}

function ReaderDocumentLayer({
  active,
  children,
  revealed,
  style,
  ...viewProps
}: React.ComponentProps<typeof View> & {
  active: boolean;
  revealed: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(0));

  // eslint-disable-next-line no-restricted-syntax -- Native opacity follows the WebView's external load and position-restoration lifecycle.
  useEffect(() => {
    opacity.stopAnimation();
    if (!active || !revealed) {
      opacity.setValue(0);
      return;
    }
    const animation = Animated.timing(opacity, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, opacity, revealed]);

  return (
    <Animated.View
      {...viewProps}
      className="absolute inset-0"
      style={[style, { opacity }]}
    >
      {children}
    </Animated.View>
  );
}

function addDocument(
  documents: Record<string, string>,
  key: string,
  html: string,
) {
  if (documents[key] === html) return documents;
  return { ...documents, [key]: html };
}

function addKey(keys: Set<string>, key: string) {
  if (keys.has(key)) return keys;
  return new Set([...keys, key]);
}

function ReaderDetail({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <Text className="text-muted-foreground mt-1 text-sm" numberOfLines={1}>
      {text}
    </Text>
  );
}

function pdfSectionAtPage(book: BookRecord, page: number) {
  return book.sections.find(
    (section) =>
      section.included &&
      page >= (section.startPage ?? 1) &&
      page <= (section.endPage ?? book.pageCount ?? 1),
  );
}

function EpubNavigation({
  count,
  index,
  onChange,
  onToggle,
  progress,
  title,
}: {
  count: number;
  index: number;
  onChange: (index: number) => void;
  onToggle: () => void;
  progress: number;
  title: string;
}) {
  return (
    <View className="w-full flex-row items-center px-2">
      <ReaderNavigationButton
        disabled={index === 0}
        label="Previous chapter"
        onPress={() => onChange(index - 1)}
        symbol="chevron.left"
      />
      <Pressable
        accessibilityHint="Expands reader controls"
        accessibilityRole="button"
        className="min-w-0 flex-1 items-center px-2 py-1"
        onPress={onToggle}
      >
        <Text
          className="text-foreground text-xs font-semibold"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-muted-foreground mt-0.5 text-[10px]">
          {progress}% complete
        </Text>
      </Pressable>
      <ReaderNavigationButton
        disabled={index === count - 1}
        label="Next chapter"
        onPress={() => onChange(index + 1)}
        symbol="chevron.right"
      />
    </View>
  );
}

function ReaderNavigationButton({
  disabled,
  label,
  onPress,
  symbol,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  symbol: "chevron.left" | "chevron.right";
}) {
  const primary = useColor("primary");
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="active:bg-muted h-13 w-14 items-center justify-center rounded-full"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={{ opacity: disabled ? 0.25 : 1 }}
    >
      <SymbolView
        name={symbol}
        size={20}
        tintColor={primary}
        weight="semibold"
      />
    </Pressable>
  );
}

function customMenuAction(key: string) {
  if (key === "libChatGPT") return "chatgpt" as const;
  if (key === "libNote") return "note" as const;
  if (key === "libUnhighlight") return "unhighlight" as const;
  return "highlight" as const;
}

function ReaderLoading({ color }: { color: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={color} />
    </View>
  );
}

function ReaderError({
  format,
  message,
}: {
  format: "EPUB" | "PDF";
  message: string;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-center text-[16px] font-semibold">
        Couldn’t open this {format}
      </Text>
      <Text className="text-muted-foreground mt-2 text-center">{message}</Text>
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The book could not be read.";
}
