import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

export type CoverSource = "files" | "photos";

export async function pickBookCover(source: CoverSource) {
  if (source === "files") {
    const picked = await File.pickFileAsync({
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      multipleFiles: false,
    });
    return picked.canceled ? undefined : picked.result;
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ["images"],
    quality: 1,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return undefined;
  return new File(asset.uri);
}
