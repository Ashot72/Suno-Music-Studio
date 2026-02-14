"use client";

import { useState, useEffect, useCallback } from "react";
import { type StatusState, type SavedPersona, IN_PROGRESS_STATUSES } from "@/app/types";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { useModelHighlight } from "@/hooks/useModelHighlight";
import { usePersonas } from "@/hooks/usePersonas";
import {
  MODELS,
  MODEL_CHAR_LIMITS,
  DEFAULTS,
  type ModelKey,
} from "@/lib/generation-constants";

type UseExtendFormStateOptions = {
  statusState: StatusState;
  setStatusState: (state: StatusState) => void;
  personas?: SavedPersona[];
  loadTaskId?: string | null;
  resetKey?: number;
  /**
   * When true, prompt and customMode start with DEFAULTS values (for Generate Music).
   * When false (default), prompt starts empty and customMode starts off (for Extend forms).
   */
  fullDefaults?: boolean;
  /** When false (for Extend), instrumental starts false so Vocal Gender is shown and sent. */
  instrumentalDefault?: boolean;
};

export function useExtendFormState({
  statusState,
  setStatusState,
  personas: personasProp,
  loadTaskId,
  resetKey = 0,
  fullDefaults = false,
  instrumentalDefault = true,
}: UseExtendFormStateOptions) {
  const [defaultParamFlag, setDefaultParamFlag] = useState(DEFAULTS.customMode);
  const [instrumental, setInstrumental] = useState(instrumentalDefault ? DEFAULTS.instrumental : false);
  const [prompt, setPrompt] = useState(fullDefaults ? DEFAULTS.prompt : "");
  const [model, setModel] = useState(DEFAULTS.model);
  const [style, setStyle] = useState(DEFAULTS.style);
  const [title, setTitle] = useState(DEFAULTS.title);
  const [continueAt, setContinueAt] = useState<number | "">(60);
  const [negativeTags, setNegativeTags] = useState(DEFAULTS.negativeTags);
  const [vocalGender, setVocalGender] = useState<"m" | "f" | "d">(DEFAULTS.vocalGender);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [styleWeight, setStyleWeight] = useState(DEFAULTS.styleWeight);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(DEFAULTS.weirdnessConstraint);
  const [audioWeight, setAudioWeight] = useState(DEFAULTS.audioWeight);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startPolling, stopPolling, setError, setTrackTitleOverride } = useStatusPolling({ setStatusState });
  const modelHighlight = useModelHighlight(model);
  const personas = usePersonas(personasProp);

  /* ── Reset all fields to defaults ── */
  const resetToDefaults = useCallback(() => {
    setDefaultParamFlag(DEFAULTS.customMode);
    setInstrumental(instrumentalDefault ? DEFAULTS.instrumental : false);
    setPrompt(fullDefaults ? DEFAULTS.prompt : "");
    setModel(DEFAULTS.model);
    setStyle(DEFAULTS.style);
    setTitle(DEFAULTS.title);
    setContinueAt(60);
    setNegativeTags(DEFAULTS.negativeTags);
    setVocalGender(DEFAULTS.vocalGender);
    setSelectedPersonaId("");
    setStyleWeight(DEFAULTS.styleWeight);
    setWeirdnessConstraint(DEFAULTS.weirdnessConstraint);
    setAudioWeight(DEFAULTS.audioWeight);
  }, [fullDefaults, instrumentalDefault]);

  /* ── Reset form when resetKey changes ── */
  useEffect(() => {
    if (resetKey === 0) return;
    resetToDefaults();
  }, [resetKey, resetToDefaults]);

  /* ── Populate form from a generation record ── */
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
        setDefaultParamFlag(g.customMode === true || g.defaultParamFlag === true);
        if (instrumentalDefault) setInstrumental(g.instrumental === true);
        setPrompt(typeof g.prompt === "string" ? g.prompt : (fullDefaults ? DEFAULTS.prompt : ""));
        setModel(typeof g.model === "string" && MODELS.includes(g.model) ? g.model : DEFAULTS.model);
        setStyle(typeof g.style === "string" ? g.style : DEFAULTS.style);
        setTitle(typeof g.title === "string" ? g.title : DEFAULTS.title);
        setContinueAt(typeof g.continueAt === "number" && g.continueAt > 0 ? g.continueAt : 60);
        setNegativeTags(typeof g.negativeTags === "string" ? g.negativeTags : DEFAULTS.negativeTags);
        setVocalGender(g.vocalGender === "f" ? "f" : g.vocalGender === "d" ? "d" : "m");
        setSelectedPersonaId(typeof g.personaId === "string" ? g.personaId : "");
        setStyleWeight(typeof g.styleWeight === "number" ? g.styleWeight : DEFAULTS.styleWeight);
        setWeirdnessConstraint(
          typeof g.weirdnessConstraint === "number" ? g.weirdnessConstraint : DEFAULTS.weirdnessConstraint
        );
        setAudioWeight(typeof g.audioWeight === "number" ? g.audioWeight : DEFAULTS.audioWeight);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTaskId, fullDefaults, instrumentalDefault]);

  /* ── Derived state ── */
  const isGenerating =
    statusState != null && IN_PROGRESS_STATUSES.includes(statusState.status as (typeof IN_PROGRESS_STATUSES)[number]);

  const charLimits = MODEL_CHAR_LIMITS[model as ModelKey] ?? MODEL_CHAR_LIMITS.V4;
  const promptLimit = charLimits.prompt;

  return {
    // State + setters
    defaultParamFlag, setDefaultParamFlag,
    instrumental, setInstrumental,
    prompt, setPrompt,
    model, setModel,
    style, setStyle,
    title, setTitle,
    continueAt, setContinueAt,
    negativeTags, setNegativeTags,
    vocalGender, setVocalGender,
    selectedPersonaId, setSelectedPersonaId,
    styleWeight, setStyleWeight,
    weirdnessConstraint, setWeirdnessConstraint,
    audioWeight, setAudioWeight,
    isSubmitting, setIsSubmitting,
    // Derived
    isGenerating,
    charLimits,
    promptLimit,
    modelHighlight,
    personas,
    // Actions
    resetToDefaults,
    // Polling helpers
    startPolling, stopPolling, setError, setTrackTitleOverride,
  };
}

/** Return type of the hook, used to type the shared component's props. */
export type ExtendFormState = ReturnType<typeof useExtendFormState>;
