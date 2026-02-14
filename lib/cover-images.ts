import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { AUDIO_DIR, getCoverFilename, isSafeCoverFilename } from "@/lib/audio";

/** Download cover image URLs and save to audio dir. Returns saved filenames. */
export async function downloadAndSaveCoverImages(
  parentTaskId: string,
  imageUrls: string[],
  apiKey?: string
): Promise<string[]> {
  await mkdir(AUDIO_DIR, { recursive: true });
  const saved: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    if (typeof url !== "string" || !url.startsWith("http")) continue;
    const filename = getCoverFilename(parentTaskId, i + 1);
    if (!isSafeCoverFilename(filename)) continue;
    try {
      const res = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      });
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const filePath = path.join(AUDIO_DIR, filename);
      await writeFile(filePath, Buffer.from(buffer));
      saved.push(filename);
    } catch {
      // skip failed download
    }
  }
  return saved;
}
