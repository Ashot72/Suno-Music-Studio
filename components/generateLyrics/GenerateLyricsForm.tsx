"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { InfoHint } from "@/components/shared/InfoHint";
import { CopyButton } from "@/components/shared/CopyButton";
import { GenerationProgress } from "@/components/generate/GenerationProgress";
import { getApiErrorMessage } from "@/lib/api-error";

const MAX_WORDS = 200;
const POLL_INTERVAL_MS = 8000;

const FAILED_STATUSES = [
  "CREATE_TASK_FAILED",
  "GENERATE_LYRICS_FAILED",
  "CALLBACK_EXCEPTION",
  "SENSITIVE_WORD_ERROR",
] as const;

type LyricVariation = {
  text: string;
  title: string;
  status: string;
  error_message?: string;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function GenerateLyricsForm() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricVariation[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordCount = countWords(prompt);
  const invalidForm = !prompt.trim() || wordCount > MAX_WORDS;
  const isBusy = isSubmitting || isPolling;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollStatus = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(
        `/api/generateLyrics/status?taskId=${encodeURIComponent(taskId)}`
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(
          (typeof data.error === "string" ? data.error : null) ||
            "Failed to fetch lyrics status"
        );
        setLyricsStatus(null);
        stopPolling();
        return;
      }
      const d = data?.data as Record<string, unknown> | undefined;
      const status = (d?.status ?? "PENDING") as string;
      setLyricsStatus(status);
      const response = (d?.response ?? {}) as Record<string, unknown>;
      const rawData = response.data;
      const lyricsArray = Array.isArray(rawData)
        ? rawData.filter((item): item is LyricVariation => item != null)
        : [];

      if (status === "SUCCESS" && lyricsArray.length > 0) {
        const completed = lyricsArray.filter(
          (l) => l.status === "complete" && l.text
        );
        if (completed.length > 0) {
          setLyrics(completed);
          setError(null);
        } else {
          const failedMsg =
            lyricsArray.find((l) => l.error_message)?.error_message ||
            "No lyrics generated";
          setError(failedMsg);
        }
        setLyricsStatus(null);
        stopPolling();
        return;
      }

      if (FAILED_STATUSES.includes(status as (typeof FAILED_STATUSES)[number])) {
        const errMsg =
          (d?.errorMessage as string) ||
          (d?.error_message as string) ||
          (data?.msg as string) ||
          "Lyrics generation failed";
        setError(errMsg);
        setLyricsStatus(null);
        stopPolling();
      }
    } catch (err) {
      setError((err as Error).message);
      setLyricsStatus(null);
      stopPolling();
    }
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || invalidForm) return;

    setIsSubmitting(true);
    setError(null);
    setLyrics(null);
    setLyricsStatus(null);
    stopPolling();

    try {
      const res = await fetch("/api/generateLyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(getApiErrorMessage(res, data, "Failed to generate lyrics"));
        return;
      }
      const taskId = data.taskId as string | undefined;
      if (!taskId) {
        setError("No task ID returned");
        return;
      }
      setLyricsStatus("PENDING");
      setIsPolling(true);
      pollStatus(taskId);
      pollRef.current = setInterval(() => pollStatus(taskId), POLL_INTERVAL_MS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setLyrics(null);
    setError(null);
    setLyricsStatus(null);
  };

  const inProgress = isSubmitting || isPolling;
  const statusLabel =
    isSubmitting ? "Submitting" : lyricsStatus === "PENDING" ? "Pending" : "Generating";
  const statusDescription =
    isSubmitting
      ? "Sending request…"
      : lyricsStatus === "PENDING"
        ? "Waiting to be processed"
        : "Creating lyrics…";

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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Generate Lyrics
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Prompt<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text={`${wordCount} / ${MAX_WORDS} words`}
                tooltip="Describe the theme, style, or subject of the desired lyrics. Max 200 words."
                id="generate-lyrics-prompt-tooltip"
                compact
                tooltipMaxWidth="20rem"
              />
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A nostalgic song about childhood memories and growing up in a small town"
              rows={4}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={2000}
            />
            {wordCount > MAX_WORDS && (
              <p className="mt-1 text-xs text-red-400">
                Prompt exceeds {MAX_WORDS} words. Please shorten it.
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
                  {isPolling ? "Generating…" : "Submitting…"}
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
                  Generate Lyrics
                </>
              )}
            </button>
          </div>
        </form>

        {inProgress && (
          <div className="mt-6">
            <GenerationProgress
              isActive={true}
              label={statusLabel}
              description={statusDescription}
            />
          </div>
        )}

        {lyrics && lyrics.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">
                Generated Variations
              </h3>
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-gray-500 hover:text-red-400"
              >
                Clear
              </button>
            </div>
            {lyrics.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-blue-400">
                    {item.title || `Variation ${idx + 1}`}
                  </h4>
                  <CopyButton text={item.text} />
                </div>
                <div className="max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-200">
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
