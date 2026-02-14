import path from "path";

export const AUDIO_DIR = path.join(process.cwd(), "audio");

export function isSafeFilename(filename: string): boolean {
  if (!filename || filename.length > 200) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  if (!filename.endsWith(".mp3")) return false;
  return /^[a-zA-Z0-9_.\-]+\.mp3$/.test(filename);
}

/** Validate cover image filename (taskId-cover-N.png). */
export function isSafeCoverFilename(filename: string): boolean {
  if (!filename || filename.length > 200) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  if (!filename.endsWith(".png")) return false;
  return /^[a-zA-Z0-9_.\-]+\.png$/.test(filename);
}

/** Build cover filename for a given music taskId and index (1-based). */
export function getCoverFilename(taskId: string, index: number): string {
  const safe = taskId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "cover";
  return `${safe}-cover-${index}.png`;
}
