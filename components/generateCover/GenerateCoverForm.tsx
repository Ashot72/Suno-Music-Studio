"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { InfoHint } from "@/components/shared/InfoHint";
import { parseSavedFilename } from "@/components/SavedTracksList";
import { getApiErrorMessage } from "@/lib/api-error";
import { GenerationProgress } from "@/components/generate/GenerationProgress";

const POLL_INTERVAL_MS = 4000;

type GenerateCoverFormProps = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  onClearSelection?: () => void;
};

export function GenerateCoverForm({
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
}: GenerateCoverFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [coverStatus, setCoverStatus] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsed = selectedTrackFilename ? parseSavedFilename(selectedTrackFilename) : null;
  const musicTaskId = parsed?.taskId ?? null;
  const hasSelection = Boolean(selectedTrackFilename && musicTaskId);
  const invalidForm = !hasSelection;
  const isBusy = isSubmitting || isPolling;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const displayImages = coverImages.length > 0 ? coverImages : imageUrls;

  useEffect(() => {
    if (!musicTaskId) {
      setCoverImages([]);
      setImageUrls([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/generateCover/check?taskId=${encodeURIComponent(musicTaskId)}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        if (data.hasCover && Array.isArray(data.coverImages) && data.coverImages.length > 0) {
          setCoverImages(data.coverImages);
          setImageUrls([]);
        } else {
          setCoverImages([]);
          setImageUrls([]);
        }
      } catch {
        if (!cancelled) {
          setCoverImages([]);
          setImageUrls([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [musicTaskId]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || invalidForm || !musicTaskId) return;

    setIsSubmitting(true);
    setError(null);
    setCoverImages([]);
    setImageUrls([]);
    setCoverStatus(null);
    stopPolling();

    try {
      const res = await fetch("/api/generateCover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: musicTaskId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(getApiErrorMessage(res, data, "Failed to generate cover"));
        return;
      }

      if (data.existing) {
        if (data.coverImages?.length) {
          setCoverImages(data.coverImages);
        } else if (data.images?.length) {
          setImageUrls(data.images);
        }
        dispatchCoverGenerated();
        return;
      }

      const coverTaskId = data.coverTaskId;
      if (!coverTaskId) {
        setError("No cover task ID returned");
        return;
      }

      const pollStatus = async () => {
        try {
          const statusRes = await fetch(
            `/api/generateCover/status?taskId=${encodeURIComponent(coverTaskId)}`
          );
          const statusData = await statusRes.json();
          if (!statusRes.ok) {
            setError(statusData.error || "Failed to fetch status");
            setCoverStatus(null);
            stopPolling();
            return;
          }
          setCoverStatus(statusData.status ?? "PENDING");
          if (statusData.status === "SUCCESS") {
            if (statusData.coverImages?.length) {
              setCoverImages(statusData.coverImages);
            } else if (statusData.images?.length) {
              setImageUrls(statusData.images);
            } else {
              const checkRes = await fetch(
                `/api/generateCover/check?taskId=${encodeURIComponent(musicTaskId)}`
              );
              const checkData = await checkRes.json();
              if (checkData.hasCover && checkData.coverImages?.length) {
                setCoverImages(checkData.coverImages);
              } else if (statusData.images?.length) {
                setImageUrls(statusData.images);
              }
            }
            setCoverStatus(null);
            stopPolling();
            dispatchCoverGenerated();
            return;
          }
          if (statusData.status === "FAILED") {
            setError("Cover generation failed");
            setCoverStatus(null);
            stopPolling();
            return;
          }
        } catch (err) {
          setError((err as Error).message);
          setCoverStatus(null);
          stopPolling();
        }
      };

      setCoverStatus("PENDING");
      setIsPolling(true);
      await pollStatus();
      pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    stopPolling();
    setCoverImages([]);
    setImageUrls([]);
    setCoverStatus(null);
    setError(null);
    onClearSelection?.();
  };

  const dispatchCoverGenerated = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cover-generated"));
    }
  }, []);

  const inProgress = coverStatus === "PENDING" || coverStatus === "GENERATING";
  const statusLabel = coverStatus === "GENERATING" ? "Generating" : "Pending";
  const statusDescription =
    coverStatus === "GENERATING" ? "Creating cover images…" : "Waiting to be processed";

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
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Generate Cover</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Source Track<span className="text-red-500"> *</span>
              </label>
              <InfoHint
                text="Select from Suno Audio Folder"
                tooltip="Choose a track from the Suno Audio Folder above. Each music task can only generate one cover."
                id="generate-cover-source-tooltip"
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
                    onClick={handleClear}
                    className="text-sm text-gray-500 hover:text-red-400"
                    title="Clear selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Select a track from the Suno Audio Folder above.
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
                  {isPolling ? "Generating…" : "Loading…"}
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
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Generate Cover
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

        {displayImages.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
            <h3 className="mb-3 text-sm font-medium text-gray-300">Cover Images</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {displayImages.map((src, i) => {
                const isLocal = coverImages.length > 0;
                const imgSrc = isLocal
                  ? `/api/audio/stream?filename=${encodeURIComponent(src)}`
                  : src;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setModalImage(imgSrc)}
                    className="overflow-hidden rounded-xl border border-[#2a2a2a] text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]"
                  >
                    <img
                      src={imgSrc}
                      alt={`Cover ${i + 1}`}
                      className="h-auto w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {modalImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Cover image preview"
          >
            <button
              type="button"
              onClick={() => setModalImage(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              aria-label="Close"
            />
            <div className="relative z-10 max-h-[90vh] max-w-[90vw]">
              <img
                src={modalImage}
                alt="Cover preview"
                className="max-h-[90vh] max-w-full rounded-xl border-2 border-[#2a2a2a] object-contain shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setModalImage(null)}
                className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:bg-[#2a2a2a] hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
