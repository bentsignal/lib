import type JSZip from "jszip";

import type { BookSection, EpubLocation } from "./model";
import { excerptFromMarkup, textFromMarkup } from "./epub-text";
import { yieldEvery } from "./yield-to-event-loop";

export interface EpubNavigationPoint {
  href: string;
  title: string;
}

interface DocumentBoundary {
  end: number;
  fragment?: string;
  start: number;
  title?: string;
}

export async function discoverEpubLocations(
  archive: JSZip,
  spineHrefs: string[],
  navigation: EpubNavigationPoint[] = [],
) {
  const locations = new Array<EpubLocation>();
  const documents = await Promise.all(
    spineHrefs.map(async (href) => ({
      href,
      source: await archive.file(href)?.async("string"),
    })),
  );
  for (const [documentIndex, { href, source }] of documents.entries()) {
    await yieldEvery(documentIndex, 8);
    if (!source) continue;
    const points = navigation.filter((point) => sameDocument(point.href, href));
    const segments = splitDocument(source, points);
    segments.forEach((segment, index) => {
      if (!hasMeaningfulContent(segment.markup)) return;
      const excerpt = excerptFromMarkup(segment.markup);
      locations.push({
        href,
        index,
        title: segment.title ?? (excerpt || `Text ${locations.length + 1}`),
        excerpt,
        fragment: segment.fragment,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
      });
    });
  }
  return locations;
}

export async function renderEpubSection(
  archive: JSZip,
  section: BookSection,
  locations: EpubLocation[],
) {
  const range = sectionLocationRange(section, locations);
  const selected = locations.slice(range.start, range.end + 1);
  return (await renderEpubLocations(archive, selected))
    .map(
      (markup, index) =>
        `<section data-lib-location="${range.start + index}">${markup}</section>`,
    )
    .join("\n");
}

export async function renderEpubLocation(
  archive: JSZip,
  location: EpubLocation,
) {
  const [markup] = await renderEpubLocations(archive, [location]);
  if (!markup) throw new Error("This EPUB location could not be found.");
  return markup;
}

export async function renderEpubLocations(
  archive: JSZip,
  locations: EpubLocation[],
  includeImages = true,
) {
  const sourceByHref = new Map<string, string | undefined>();
  const rendered = new Array<string>();
  for (const [locationIndex, location] of locations.entries()) {
    await yieldEvery(locationIndex, 24);
    let source = sourceByHref.get(location.href);
    if (!sourceByHref.has(location.href)) {
      const rawSource = await archive.file(location.href)?.async("string");
      source = rawSource
        ? extractBody(stripUnsafeMarkup(rawSource))
        : undefined;
      sourceByHref.set(location.href, source);
    }
    if (!source) {
      rendered.push("");
      continue;
    }
    const markup = locationMarkup(source, location);
    if (!markup) {
      rendered.push("");
      continue;
    }
    rendered.push(
      includeImages
        ? await embedImages(archive, location.href, markup)
        : markup,
    );
  }
  return rendered;
}

export function sectionLocationRange(
  section: BookSection,
  locations: EpubLocation[],
) {
  if (locations.length === 0) return { start: 0, end: 0 };
  const fallback = Math.max(
    0,
    locations.findIndex((location) =>
      sameDocument(location.href, section.href),
    ),
  );
  const fallbackEnd = locations.reduce(
    (last, location, index) =>
      sameDocument(location.href, section.href) ? index : last,
    fallback,
  );
  const start = clamp(
    section.startLocation ?? fallback,
    0,
    locations.length - 1,
  );
  const end = clamp(
    section.endLocation ?? fallbackEnd,
    start,
    locations.length - 1,
  );
  return { start, end };
}

function splitDocument(source: string, navigation: EpubNavigationPoint[] = []) {
  const body = extractBody(stripUnsafeMarkup(source));
  const boundaries = documentBoundaries(body, navigation);
  if (boundaries.length === 0) {
    return [
      {
        markup: body,
        start: 0,
        end: body.length,
        title: undefined,
        startOffset: 0,
        endOffset: body.length,
      },
    ];
  }
  const complete = withUncoveredText(body, boundaries);
  return complete.map((boundary) => {
    return {
      ...boundary,
      markup: body.slice(boundary.start, boundary.end),
      startOffset: boundary.start,
      endOffset: boundary.end,
    };
  });
}

function withUncoveredText(body: string, boundaries: DocumentBoundary[]) {
  const complete = new Array<DocumentBoundary>();
  let cursor = 0;
  for (const boundary of boundaries) {
    if (hasMeaningfulContent(body.slice(cursor, boundary.start))) {
      complete.push({ start: cursor, end: boundary.start });
    }
    complete.push(boundary);
    cursor = boundary.end;
  }
  if (hasMeaningfulContent(body.slice(cursor))) {
    complete.push({ start: cursor, end: body.length });
  }
  return complete;
}

function documentBoundaries(body: string, navigation: EpubNavigationPoint[]) {
  const blockPattern =
    /<(h[1-6]|p|blockquote|pre|figure|table|ul|ol)\b[^>]*>[\s\S]*?<\/\1\s*>|<(img|image)\b[^>]*\/?\s*>/giu;
  const boundaryDetails = new Array<DocumentBoundary>();
  for (const block of body.matchAll(blockPattern)) {
    const markup = block[0];
    boundaryDetails.push({
      start: block.index,
      end: block.index + markup.length,
      title: /^<h[1-6]\b/iu.test(markup) ? textFromMarkup(markup) : undefined,
    });
  }
  for (const point of navigation) {
    const fragment = fragmentFromHref(point.href);
    const offset = fragment ? fragmentOffset(body, fragment) : 0;
    if (offset < 0) continue;
    const boundary =
      boundaryDetails.find(
        (item) => item.start <= offset && item.end > offset,
      ) ?? boundaryDetails.find((item) => item.start >= offset);
    if (!boundary) continue;
    boundary.title = point.title;
    boundary.fragment = fragment;
  }
  return boundaryDetails;
}

function locationMarkup(source: string, location: EpubLocation) {
  if (location.startOffset !== undefined && location.endOffset !== undefined) {
    return source.slice(location.startOffset, location.endOffset);
  }
  return source;
}

function fragmentFromHref(href: string) {
  const fragment = href.split("#")[1];
  return fragment ? decodeURIComponent(fragment) : undefined;
}

function fragmentOffset(body: string, fragment: string) {
  const escaped = escapeRegExp(fragment);
  const pattern = new RegExp(
    `<[^>]*\\b(?:id|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
    "iu",
  );
  return pattern.exec(body)?.index ?? -1;
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function stripUnsafeMarkup(source: string) {
  return source
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, "")
    .replaceAll(
      /<(?:iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)\s*>/giu,
      "",
    )
    .replaceAll(/<(?:iframe|object|embed|form)\b[^>]*\/?>/giu, "")
    .replaceAll(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/giu, "")
    .replaceAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*\/?>/giu, "");
}

function extractBody(source: string) {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/iu.exec(source);
  if (match?.[1]) return match[1];
  return source
    .replace(/<\?xml[^>]*>/iu, "")
    .replace(/<!doctype[^>]*>/iu, "")
    .replaceAll(/<\/?(?:html|head)\b[^>]*>/giu, "");
}

async function embedImages(
  archive: JSZip,
  chapterPath: string,
  markup: string,
) {
  const pattern =
    /(<(?:img|image)\b[^>]*?\s(?:src|href|xlink:href)\s*=\s*["'])([^"']+)(["'])/giu;
  let result = markup;
  for (const match of markup.matchAll(pattern)) {
    const [whole, prefix, href, quote] = match;
    if (!whole || !prefix || !href || !quote || !isLocalAsset(href)) continue;
    const assetPath = normalizeHref(chapterPath, href);
    const asset = archive.file(assetPath);
    if (!asset) continue;
    const base64 = await asset.async("base64");
    result = result.replace(
      whole,
      `${prefix}data:${imageMediaType(assetPath)};base64,${base64}${quote}`,
    );
  }
  return result;
}

function hasMeaningfulContent(markup: string | undefined) {
  if (!markup) return false;
  return /<(?:img|image)\b/iu.test(markup) || textFromMarkup(markup).length > 0;
}

function sameDocument(first: string, second: string | undefined) {
  return stripUrlSuffix(first) === stripUrlSuffix(second ?? "");
}

function isLocalAsset(href: string) {
  return !/^(?:data:|https?:|#)/iu.test(href);
}

function normalizeHref(parentFile: string, href: string) {
  const base = stripUrlSuffix(parentFile).split("/").slice(0, -1);
  const parts = [
    ...base,
    ...decodeURIComponent(stripUrlSuffix(href)).split("/"),
  ];
  const normalized = new Array<string>();
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function stripUrlSuffix(value: string) {
  return value.split(/[?#]/u)[0] ?? value;
}

function imageMediaType(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
