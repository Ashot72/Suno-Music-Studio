"use client";

import { useState } from "react";
import { InfoHint } from "@/components/shared/InfoHint";
import { CopyButton } from "@/components/shared/CopyButton";
import { GenerationProgress } from "@/components/generate/GenerationProgress";
import { parseSavedFilename } from "@/components/SavedTracksList";
import { getApiErrorMessage } from "@/lib/api-error";

type AlignedWord = {
  word: string;
  success?: boolean;
  startS?: number;
  endS?: number;
  palign?: number;
};

type GetLyricsFormProps = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  selectedAudioId?: string | null;
  onClearSelection?: () => void;
};

function formatLyrics(alignedWords: AlignedWord[]): string[] {
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const item of alignedWords) {
    const w = (item.word ?? "").trim();
    if (!w) continue;

    const parts = w.split("\n").filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i > 0) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" ").trim());
          currentLine = [];
        }
        currentLine.push(part);
      } else {
        currentLine.push(part);
      }
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.join(" ").trim());
  }
  return lines;
}

export function GetLyricsForm({
  selectedTrackFilename,
  selectedTrackName,
  selectedAudioId,
  onClearSelection,
}: GetLyricsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lyricsData, setLyricsData] = useState<{
    alignedWords: AlignedWord[];
    waveformData?: number[];
    hootCer?: number;
  } | null>(null);

  const hasSelection = Boolean(selectedTrackFilename && selectedAudioId);
  const invalidForm = !hasSelection;
  const isBusy = isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || invalidForm) return;

    const parsed = selectedTrackFilename ? parseSavedFilename(selectedTrackFilename) : null;
    if (!parsed || !selectedAudioId) return;

    setIsSubmitting(true);
    setError(null);
    setLyricsData(null);

    try {
      const res = await fetch("/api/getLyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: parsed.taskId,
          audioId: selectedAudioId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(getApiErrorMessage(res, data, "Failed to get lyrics"));
        return;
      }
      const alignedWords = Array.isArray(data?.alignedWords) ? data.alignedWords : [];
      if (alignedWords.length === 0) {
        setError("No lyrics data returned for this track.");
        return;
      }
      setLyricsData({
        alignedWords,
        waveformData: Array.isArray(data?.waveformData) ? data.waveformData : undefined,
        hootCer: typeof data?.hootCer === "number" ? data.hootCer : undefined,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearLyrics = () => {
    setLyricsData(null);
    setError(null);
  };

  const copyText =
    lyricsData?.alignedWords?.length ? formatLyrics(lyricsData.alignedWords).join("\n") : "";

  return (
    <section
      className={`relative mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 ${isBusy ? "select-none opacity-90" : ""}`}
      aria-busy={isBusy}
    >
      {isBusy && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
          aria-hidden
        />
      )}
      <div className={isBusy ? "pointer-events-none" : ""}>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Get Lyrics</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Source Track<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Select from Suno Audio Folder"
                tooltip="Choose a vocal track from the Suno Audio Folder above. Instrumental tracks are excluded."
                id="get-lyrics-source-tooltip"
                compact
                tooltipMaxWidth="20rem"
              />
            </div>
            {hasSelection ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-900/50 bg-[#0f0f0f] p-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden />
                <span className="flex-1 text-sm text-green-400">
                  {selectedTrackName ?? selectedTrackFilename?.replace(/\.mp3$/i, "") ?? "Selected"}
                </span>
                {onClearSelection && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearSelection();
                      handleClearLyrics();
                    }}
                    className="text-sm text-gray-500 hover:text-red-400"
                    title="Clear selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Select a vocal track from the Suno Audio Folder above.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={invalidForm || isBusy}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-white"
                    aria-hidden
                  />
                  Loading…
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Get Lyrics
                </>
              )}
            </button>
          </div>
        </form>

        {isBusy && (
          <div className="mt-6">
            <GenerationProgress
              isActive={true}
              label="Fetching lyrics"
              description="Retrieving lyrics for the selected track…"
            />
          </div>
        )}

        {lyricsData && lyricsData.alignedWords.length > 0 && (
          <div className="mt-6 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-300">Timestamped Lyrics</h3>
              <CopyButton text={copyText} />
            </div>
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-200">
              {formatLyrics(lyricsData.alignedWords).map((line, i) => (
                <div key={i} className="py-0.5">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
