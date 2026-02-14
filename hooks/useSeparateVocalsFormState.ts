"use client";

import { useCallback, useRef } from "react";
import { type StatusState, type SunoTrack, FAILED_STATUSES } from "@/app/types";

type UseSeparateVocalsFormStateOptions = {
  setStatusState: (state: StatusState) => void;
};

const STEM_KEYS: [string, string][] = [
  ["vocalUrl", "vocal_url"],
  ["instrumentalUrl", "instrumental_url"],
];

function mapVocalSeparationToTracks(
  response: Record<string, unknown> | null,
  sourceTrackTitle?: string | null
): SunoTrack[] {
  if (!response || typeof response !== "object") return [];
  const title = sourceTrackTitle?.trim() || null;
  const tracks: SunoTrack[] = [];
  for (const [camelKey, snakeKey] of STEM_KEYS) {
    const url = response[camelKey] ?? response[snakeKey];
    if (typeof url === "string" && url.startsWith("http")) {
      tracks.push({
        id: String(tracks.length),
        audioUrl: url,
        title: title ?? (snakeKey === "vocal_url" ? "Vocals" : "Instrumental"),
      });
    }
  }
  return tracks;
}

export function useSeparateVocalsFormState({
  setStatusState,
}: UseSeparateVocalsFormStateOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceTrackTitleRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const setError = useCallback(
    (error: string) =>
      setStatusState({ taskId: "", status: "ERROR", tracks: [], error }),
    [setStatusState]
  );

  const pollStatus = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(
          `/api/separateVocals/status?taskId=${encodeURIComponent(taskId)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to fetch status");
          stopPolling();
          return;
        }
        const d = data?.data ?? data;
        const response = d?.response ?? {};
        const successFlag = (response.successFlag ?? d?.successFlag)?.toString();
        const status =
          (d?.status ?? successFlag ?? "PENDING").toString().toUpperCase();
        const isSuccess =
          status === "SUCCESS" ||
          status === "COMPLETED" ||
          status?.toLowerCase() === "complete" ||
          successFlag === "SUCCESS";
        const errorMessage =
          (d?.errorMessage ?? d?.error_message ?? response?.errorMessage) as
            | string
            | undefined;

        const tracks = mapVocalSeparationToTracks(
          response as Record<string, unknown>,
          sourceTrackTitleRef.current
        );

        const displayError =
          !isSuccess &&
          errorMessage &&
          typeof errorMessage === "string"
            ? errorMessage
            : undefined;

        setStatusState({
          taskId,
          status: isSuccess ? "SUCCESS" : status || "PENDING",
          tracks,
          error: displayError,
        });

        if (isSuccess && tracks.length > 0) {
          try {
            await fetch("/api/audio/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId,
                tracks: tracks.map((t) => ({
                  id: t.id,
                  audioUrl: t.audioUrl,
                  title: t.title,
                })),
              }),
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("audio-saved"));
            }
          } catch {
            // ignore save errors
          }
        }

        if (
          isSuccess ||
          FAILED_STATUSES.includes(status as (typeof FAILED_STATUSES)[number])
        ) {
          stopPolling();
        }
      } catch (err) {
        setError((err as Error).message);
        stopPolling();
      }
    },
    [setStatusState, setError, stopPolling]
  );

  const startPolling = useCallback(
    (taskId: string, sourceTrackTitle?: string | null) => {
      stopPolling();
      sourceTrackTitleRef.current = sourceTrackTitle ?? null;
      pollStatus(taskId);
      pollRef.current = setInterval(() => pollStatus(taskId), 5000);
    },
    [pollStatus, stopPolling]
  );

  return { startPolling, stopPolling, setError };
}
