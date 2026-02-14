"use client";

import { useCallback, useRef } from "react";
import { type StatusState, type SunoTrack, FAILED_STATUSES } from "@/app/types";
import { getApiErrorMessage } from "@/lib/api-error";

type UseStatusPollingOptions = {
  setStatusState: (state: StatusState) => void;
};

/**
 * Shared polling hook for Generate and Extend music.
 * Polls `/api/generate/status`, maps tracks, auto-saves on success.
 */
export function useStatusPolling({ setStatusState }: UseStatusPollingOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** When set, overrides the KIE-returned track title when saving (e.g. uploaded source filename). */
  const trackTitleOverrideRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const setError = useCallback(
    (error: string) => setStatusState({ taskId: "", status: "ERROR", tracks: [], error }),
    [setStatusState]
  );

  const pollStatus = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`/api/generate/status?taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(
            getApiErrorMessage(res, data as Record<string, unknown>, "Failed to fetch status")
          );
          stopPolling();
          return;
        }
        const d = data?.data as Record<string, unknown> | undefined;
        const response = (d?.response ?? {}) as Record<string, unknown>;
        const rawSuno =
          response.sunoData ?? response.suno_data ?? response.data ?? d?.tracks ?? data?.tracks;
        const rawArray = Array.isArray(rawSuno)
          ? rawSuno.filter((t: unknown) => t != null)
          : rawSuno != null
            ? [rawSuno]
            : [];
        const tracks: SunoTrack[] = rawArray.map((t: Record<string, unknown>, index: number) => ({
          id: String(t.id ?? index),
          audioUrl: String(t.audioUrl ?? t.audio_url ?? ""),
          streamAudioUrl: t.streamAudioUrl ?? t.stream_audio_url != null ? String(t.stream_audio_url) : undefined,
          imageUrl: t.imageUrl ?? t.image_url != null ? String(t.image_url) : undefined,
          prompt: t.prompt != null ? String(t.prompt) : undefined,
          modelName: t.modelName ?? t.model_name != null ? String(t.model_name) : undefined,
          title: String(t.title ?? "Untitled"),
          tags: t.tags != null ? String(t.tags) : undefined,
          createTime: t.createTime != null ? String(t.createTime) : undefined,
          duration: typeof t.duration === "number" ? t.duration : undefined,
        }));
        const resp = d?.response as Record<string, unknown> | undefined;
        let status = (d?.status ?? resp?.status ?? data?.status ?? "PENDING").toString();
        if (
          status === "PENDING" &&
          tracks.length > 0 &&
          tracks.some((t) => t.audioUrl && t.audioUrl.length > 0)
        ) {
          const trackStatuses = rawArray.map(
            (t: Record<string, unknown>) => (t?.status ?? t?.Status ?? "").toString()
          );
          const allSuccess = trackStatuses.every(
            (s) =>
              s === "SUCCESS" ||
              s === "COMPLETED" ||
              s?.toLowerCase() === "complete" ||
              s?.toLowerCase() === "success"
          );
          if (allSuccess || trackStatuses.some((s) => s?.toLowerCase() === "success")) {
            status = "SUCCESS";
          }
        }
        const errorMessage =
          d?.errorMessage ?? d?.error_message ?? d?.msg ?? (typeof d?.error === "string" ? d.error : null);
        const isSuccessStatus =
          status === "SUCCESS" ||
          status === "COMPLETED" ||
          status?.toLowerCase() === "complete" ||
          status?.toLowerCase() === "success";
        const displayError =
          !isSuccessStatus && errorMessage && typeof errorMessage === "string" ? errorMessage : undefined;
        setStatusState({
          taskId,
          status,
          tracks,
          error: displayError,
        });
        if (isSuccessStatus && tracks.length > 0) {
          try {
            const override = trackTitleOverrideRef.current;
            await fetch("/api/audio/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId,
                tracks: tracks.map((t) => ({
                  id: t.id,
                  audioUrl: t.audioUrl,
                  title: override || t.title,
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
        if (isSuccessStatus || FAILED_STATUSES.includes(status as (typeof FAILED_STATUSES)[number])) {
          stopPolling();
        }
      } catch (err) {
        setError((err as Error).message);
        stopPolling();
      }
    },
    [setStatusState, setError, stopPolling]
  );

  /** Start polling immediately then every 8 seconds. Returns cleanup function. */
  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling();
      pollStatus(taskId);
      pollRef.current = setInterval(() => pollStatus(taskId), 8000);
    },
    [pollStatus, stopPolling]
  );

  const setTrackTitleOverride = useCallback((title: string | null) => {
    trackTitleOverrideRef.current = title;
  }, []);

  return { pollStatus, startPolling, stopPolling, setError, pollRef, setTrackTitleOverride };
}
