import JSZip from "jszip";

import type { EpubLocation } from "./model";
import { renderEpubLocations } from "./epub-content";
import { textFromMarkup } from "./epub-text";
import { yieldEvery } from "./yield-to-event-loop";

export async function extractEpubLocationTexts(
  source: Uint8Array,
  locations: EpubLocation[],
) {
  const archive = await JSZip.loadAsync(source);
  const markup = await renderEpubLocations(archive, locations, false);
  const texts = new Array<string>();
  for (const [index, locationMarkup] of markup.entries()) {
    await yieldEvery(index, 32);
    texts.push(textFromMarkup(locationMarkup));
  }
  return texts;
}
