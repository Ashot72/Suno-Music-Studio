"use client";

import { useState, useEffect, useCallback } from "react";
import { type StatusState, IN_PROGRESS_STATUSES } from "@/app/types";
import { useStatusPolling } from "@/hooks/useStatusPolling";

/** Model options for Add Vocals (API supports V4_5PLUS and V5 only). */
export const ADD_VOCALS_MODELS = ["V4_5PLUS", "V5"] as const;

export type AddVocalsModelKey = (typeof ADD_VOCALS_MODELS)[number];

const DEFAULTS = {
  title: "Calm Piano Vocals",
  prompt: "[Verse] Calm piano melody, soft and soothing",
  style: "Jazz",
  negativeTags: "heavy metal, strong drums",
  model: "V4_5PLUS" as AddVocalsModelKey,
  vocalGender: "m" as "m" | "f" | "d",
  styleWeight: 0.65,
  weirdnessConstraint: 0.65,
  audioWeight: 0.65,
};

type UseAddVocalsFormStateOptions = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  loadTaskId?: string | null;
  resetKey?: number;
};

export function useAddVocalsFormState({
  statusState,
  setStatusState,
  loadTaskId,
  resetKey = 0,
}: UseAddVocalsFormStateOptions) {
  const [title, setTitle] = useState(DEFAULTS.title);
  const [prompt, setPrompt] = useState(DEFAULTS.prompt);
  const [style, setStyle] = useState(DEFAULTS.style);
  const [negativeTags, setNegativeTags] = useState(DEFAULTS.negativeTags);
  const [model, setModel] = useState<AddVocalsModelKey>(DEFAULTS.model);
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
    setPrompt(DEFAULTS.prompt);
    setStyle(DEFAULTS.style);
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
        if (g.prompt) setPrompt(g.prompt);
        if (g.style) setStyle(g.style);
        if (g.title) setTitle(g.title);
        if (g.negativeTags) setNegativeTags(g.negativeTags);
        if (ADD_VOCALS_MODELS.includes(g.model))
          setModel(g.model as AddVocalsModelKey);
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
    prompt,
    setPrompt,
    style,
    setStyle,
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

export type AddVocalsFormState = ReturnType<typeof useAddVocalsFormState>;
