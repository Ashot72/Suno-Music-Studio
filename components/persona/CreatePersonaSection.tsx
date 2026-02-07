"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PersonaTaskMeta, PersonaTrackMeta, SavedPersona } from "@/app/types";
import { parseSavedFilename } from "@/components/SavedTracksList";

type EligibleTrack = { taskId: string; track: PersonaTrackMeta };

function isCreditsError(err: string): boolean {
  const lower = err.toLowerCase();
  return lower.includes("credit") || lower.includes("insufficient") || lower.includes("top up");
}

const FORM_INPUT_CLASS =
  "w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-80 disabled:bg-[#1a1a1a] disabled:border-[#2a2a2a]";
const CREDITS_FALLBACK = "Your balance isn't enough. Please top up to continue.";
const CREATE_PERSONA_FAILED = "Create Persona failed";

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

type CreatePersonaSectionProps = {
  selectedAudioFilename?: string | null;
  /** When provided (e.g. from page), used instead of fetching. */
  personaMetadata?: Record<string, PersonaTaskMeta> | null;
  personas?: SavedPersona[];
  /** When set, show this persona's details and disable Create Persona button. */
  selectedViewPersona?: SavedPersona | null;
};

export function CreatePersonaSection({
  selectedAudioFilename = null,
  personaMetadata: personaMetadataProp,
  personas: personasProp,
  selectedViewPersona = null,
}: CreatePersonaSectionProps) {
  const [tasks, setTasks] = useState<Record<string, PersonaTaskMeta>>({});
  const [personas, setPersonas] = useState<SavedPersona[]>([]);
  const [loading, setLoading] = useState(personaMetadataProp === undefined);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<EligibleTrack | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const tasksEffective = personaMetadataProp ?? tasks;
  const personasEffective = personasProp ?? personas;
  const hasDataFromParent = personaMetadataProp !== undefined;

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch("/api/personas/metadata");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load metadata");
      setTasks(data.tasks ?? {});
    } catch (err) {
      setError((err as Error).message);
      setTasks({});
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetch("/api/personas");
      const data = await res.json();
      if (res.ok && Array.isArray(data.personas)) setPersonas(data.personas);
      else setPersonas([]);
    } catch {
      setPersonas([]);
    }
  }, []);

  useEffect(() => {
    if (hasDataFromParent) {
      setLoading(false);
      return;
    }
    fetchMetadata();
    fetchPersonas();
  }, [hasDataFromParent, fetchMetadata, fetchPersonas]);

  useEffect(() => {
    if (hasDataFromParent) return;
    const onSaved = () => fetchMetadata();
    window.addEventListener("audio-saved", onSaved);
    return () => window.removeEventListener("audio-saved", onSaved);
  }, [hasDataFromParent, fetchMetadata]);

  useEffect(() => {
    if (hasDataFromParent) return;
    const onPersonaCreated = () => {
      fetchPersonas();
      fetchMetadata();
    };
    window.addEventListener("persona-created", onPersonaCreated);
    return () => window.removeEventListener("persona-created", onPersonaCreated);
  }, [hasDataFromParent, fetchPersonas, fetchMetadata]);

  const eligible = useMemo<EligibleTrack[]>(() => {
    const out: EligibleTrack[] = [];
    for (const task of Object.values(tasksEffective)) {
      if (!task) continue;
      for (const track of task.tracks ?? []) {
        if (track.id?.trim()) out.push({ taskId: task.taskId, track });
      }
    }
    return out;
  }, [tasksEffective]);

  useEffect(() => {
    if (selectedAudioFilename?.trim() && Object.keys(tasksEffective).length > 0) {
      const parsed = parseSavedFilename(selectedAudioFilename);
      if (parsed) {
        const task = tasksEffective[parsed.taskId];
        const track = task?.tracks?.[parsed.index - 1];
        if (track?.id?.trim()) {
          setSelectedTrack({ taskId: parsed.taskId, track });
          return;
        }
      }
      setSelectedTrack(null);
      return;
    }
    if (!selectedAudioFilename && eligible.length > 0) setSelectedTrack(eligible[0]);
    else if (!selectedAudioFilename) setSelectedTrack(null);
  }, [tasksEffective, selectedAudioFilename, eligible]);

  useEffect(() => {
    if (selectedViewPersona) {
      setName(selectedViewPersona.name);
      setDescription(selectedViewPersona.description);
    } else if (selectedTrack) {
      const title = (selectedTrack.track.title ?? "").trim();
      setName(title ? `${title} - Persona` : "Persona");
      setDescription("");
    } else {
      setName("");
      setDescription("");
    }
  }, [selectedViewPersona, selectedTrack]);

  /** Persona already created for the currently selected track, if any. */
  const existingPersona = useMemo(() => {
    if (!selectedTrack?.track.id?.trim()) return null;
    return personasEffective.find(
      (p) => p.taskId === selectedTrack.taskId && p.audioId === selectedTrack.track.id?.trim()
    ) ?? null;
  }, [personasEffective, selectedTrack]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrack?.track.id?.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/personas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTrack.taskId,
          audioId: selectedTrack.track.id.trim(),
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const credits = res.status === 402 || data.code === 402;
        const msg =
          data.error ?? data.message ?? data.msg ?? (credits ? CREDITS_FALLBACK : CREATE_PERSONA_FAILED);
        throw new Error(typeof msg === "string" ? msg : CREATE_PERSONA_FAILED);
      }
      setDescription("");
      window.dispatchEvent(new CustomEvent("persona-created"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <section className="mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-200">Generate Persona</h2>
        <p className="text-sm text-gray-500">Loading...</p>
      </section>
    );
  }

  return (
    <section className="mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      {error && (
        <div
          className={
            isCreditsError(error)
              ? "mb-4 rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-sm text-amber-300"
              : "mb-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300"
          }
        >
          {isCreditsError(error) ? (
            <>
              <p className="font-medium text-amber-400">Insufficient credits</p>
              <p className="mt-1">{error}</p>
            </>
          ) : (
            error
          )}
        </div>
      )}

      {eligible.length === 0 && !selectedViewPersona ? (
        <p className="text-sm text-gray-500">
          No tracks with audio ID yet. Save a generated track first (non-instrumental tracks
          include an audio ID).
        </p>
      ) : (
        <div className="space-y-6">
          {selectedTrack && existingPersona ? (
            <div className="space-y-3 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
              <p className="text-xs text-gray-500">A persona has already been created for this track.</p>
              <div>
                <p className="mb-1 text-xs text-gray-400">Name</p>
                <p className="text-sm text-gray-200">{existingPersona.name}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-gray-400">Description</p>
                <p className="whitespace-pre-wrap text-sm text-gray-200">{existingPersona.description}</p>
              </div>
            </div>
          ) : (selectedTrack || selectedViewPersona) ? (
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Electronic Pop Singer"
                  required
                  className={FORM_INPUT_CLASS}
                  disabled={!!selectedViewPersona}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Musical characteristics, style, personality..."
                  required
                  rows={3}
                  className={FORM_INPUT_CLASS}
                  disabled={!!selectedViewPersona}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating || !!selectedViewPersona || !name.trim() || !description.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                      Creating...
                    </>
                  ) : (
                    <>
                      <PersonIcon className="h-4 w-4 shrink-0" aria-hidden />
                      Create Persona
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </section>
  );
}
