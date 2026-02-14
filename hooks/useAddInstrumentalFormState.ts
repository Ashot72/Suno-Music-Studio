"use client";

import { useState, useEffect, useCallback } from "react";
import { type StatusState, IN_PROGRESS_STATUSES } from "@/app/types";
import { useStatusPolling } from "@/hooks/useStatusPolling";

/** Model options for Add Instrumental (API supports V4_5PLUS and V5 only). */
export const ADD_INSTRUMENTAL_MODELS = ["V4_5PLUS", "V5"] as const;

export type AddInstrumentalModelKey = (typeof ADD_INSTRUMENTAL_MODELS)[number];

const DEFAULTS = {
  title: "Relaxing Piano",
  tags: "relaxing, piano, soothing",
  negativeTags: "heavy metal, fast drums",
  model: "V4_5PLUS" as AddInstrumentalModelKey,
  vocalGender: "m" as "m" | "f" | "d",
  styleWeight: 0.65,
  weirdnessConstraint: 0.65,
  audioWeight: 0.65,
};

type UseAddInstrumentalFormStateOptions = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  loadTaskId?: string | null;
  resetKey?: number;
};

export function useAddInstrumentalFormState({
  statusState,
  setStatusState,
  loadTaskId,
  resetKey = 0,
}: UseAddInstrumentalFormStateOptions) {
  const [title, setTitle] = useState(DEFAULTS.title);
  const [tags, setTags] = useState(DEFAULTS.tags);
  const [negativeTags, setNegativeTags] = useState(DEFAULTS.negativeTags);
  const [model, setModel] = useState<AddInstrumentalModelKey>(DEFAULTS.model);
  const [vocalGender, setVocalGender] = useState<"m" | "f" | "d">(DEFAULTS.vocalGender);
  const [styleWeight, setStyleWeight] = useState(DEFAULTS.styleWeight);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(
    DEFAULTS.weirdnessConstraint
  );
  const [audioWeight, setAudioWeight] = useState(DEFAULTS.audioWeight);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { startPolling, stopPolling, setError, setTrackTitleOverride } =
    useStatusPolling({ setStatusState });

  const resetToDefaults = useCallback(() => {
    setTitle(DEFAULTS.title);
    setTags(DEFAULTS.tags);
    setNegativeTags(DEFAULTS.negativeTags);
    setModel(DEFAULTS.model);
    setVocalGender(DEFAULTS.vocalGender);
    setStyleWeight(DEFAULTS.styleWeight);
    setWeirdnessConstraint(DEFAULTS.weirdnessConstraint);
    setAudioWeight(DEFAULTS.audioWeight);
  }, []);

  useEffect(() => {
    if (resetKey === 0) return;
    resetToDefaults();
  }, [resetKey, resetToDefaults]);

  useEffect(() => {
    if (!loadTaskId?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/generate/generation?taskId=${encodeURIComponent(loadTaskId.trim())}`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const g = data?.generation;
        if (!g || typeof g !== "object") return;
        if (g.style) setTags(g.style);
        if (g.title) setTitle(g.title);
        if (g.negativeTags) setNegativeTags(g.negativeTags);
        if (ADD_INSTRUMENTAL_MODELS.includes(g.model))
          setModel(g.model as AddInstrumentalModelKey);
        if (g.vocalGender === "f" || g.vocalGender === "m" || g.vocalGender === "d")
          setVocalGender(g.vocalGender);
        if (typeof g.styleWeight === "number") setStyleWeight(g.styleWeight);
        if (typeof g.weirdnessConstraint === "number")
          setWeirdnessConstraint(g.weirdnessConstraint);
        if (typeof g.audioWeight === "number") setAudioWeight(g.audioWeight);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTaskId]);

  const isGenerating =
    statusState != null &&
    IN_PROGRESS_STATUSES.includes(statusState.status as (typeof IN_PROGRESS_STATUSES)[number]);

  return {
    title,
    setTitle,
    tags,
    setTags,
    negativeTags,
    setNegativeTags,
    model,
    setModel,
    vocalGender,
    setVocalGender,
    styleWeight,
    setStyleWeight,
    weirdnessConstraint,
    setWeirdnessConstraint,
    audioWeight,
    setAudioWeight,
    showAdvanced,
    setShowAdvanced,
    isSubmitting,
    setIsSubmitting,
    isGenerating,
    resetToDefaults,
    startPolling,
    stopPolling,
    setError,
    setTrackTitleOverride,
  };
}

export type AddInstrumentalFormState = ReturnType<
  typeof useAddInstrumentalFormState
>;
