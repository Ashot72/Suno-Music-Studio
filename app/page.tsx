"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import type { StatusState, PersonaTaskMeta, SavedPersona } from "@/app/types";
import { SavedTracksList, parseSavedFilename } from "@/components/SavedTracksList";
import { GenerateForm } from "@/components/generate/GenerateForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";
import { CoverSection } from "@/components/cover/CoverSection";
import { ExtendSection } from "@/components/extend/ExtendSection";
import { CreatePersonaSection } from "@/components/persona/CreatePersonaSection";
import { PersonasList } from "@/components/persona/PersonasList";
import { AppTitleWithLogo } from "@/components/shared/AppTitle";

export type AppMode = "generate" | "extend" | "cover" | "persona";

const MODE_OPTIONS: { value: AppMode; label: string }[] = [
  { value: "generate", label: "Generate Music" },
  { value: "extend", label: "Extend Music" },
  { value: "cover", label: "Generate Music Cover" },
  { value: "persona", label: "Generate Persona" },
];

const MODE_STORAGE_KEY = "suno-mode";

function getStoredMode(): AppMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
    if (stored && MODE_OPTIONS.some((o) => o.value === stored)) return stored;
  } catch {
    // ignore
  }
  return null;
}

export default function Home() {
  const { status: authStatus } = useSession();
  const prevAuthStatusRef = useRef<string | null>(null);
  const [statusState, setStatusState] = useState<StatusState>(null);
  const [mode, setMode] = useState<AppMode>("generate");
  const [selectedAudioFilename, setSelectedAudioFilename] = useState<string | null>(null);
  const [loadFormSelectedFilename, setLoadFormSelectedFilename] = useState<string | null>(null);
  const [selectedViewPersonaId, setSelectedViewPersonaId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [personaTasks, setPersonaTasks] = useState<Record<string, PersonaTaskMeta> | null>(null);
  const [personaList, setPersonaList] = useState<SavedPersona[]>([]);
  const [personaDataLoading, setPersonaDataLoading] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  const handleNewGeneration = useCallback(() => {
    // Stop all playing audio and reset to start
    document.querySelectorAll("audio").forEach((el) => {
      el.pause();
      el.currentTime = 0;
    });
    // Reset form and status
    setStatusState(null);
    setLoadFormSelectedFilename(null);
    setFormResetKey((k) => k + 1);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePersonaTrackSelect = useCallback((filename: string | null) => {
    setSelectedViewPersonaId(null);
    setSelectedAudioFilename(filename);
  }, []);

  const handleSelectViewPersona = useCallback((personaId: string | null) => {
    setSelectedAudioFilename(null);
    setSelectedViewPersonaId(personaId);
  }, []);

  const fetchPersonaData = useCallback(async () => {
    setPersonaDataLoading(true);
    try {
      const [metaRes, personasRes] = await Promise.all([
        fetch("/api/personas/metadata"),
        fetch("/api/personas"),
      ]);
      const metaData = await metaRes.json();
      const personasData = await personasRes.json();
      if (metaRes.ok && metaData?.tasks && typeof metaData.tasks === "object") {
        setPersonaTasks(metaData.tasks);
      } else {
        setPersonaTasks(null);
      }
      if (personasRes.ok && Array.isArray(personasData.personas)) {
        setPersonaList(personasData.personas);
      } else {
        setPersonaList([]);
      }
    } catch {
      setPersonaTasks(null);
      setPersonaList([]);
    } finally {
      setPersonaDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated" && prevAuthStatusRef.current === "authenticated") {
      try {
        localStorage.removeItem(MODE_STORAGE_KEY);
        setMode("generate");
      } catch {
        // ignore
      }
    } else if (authStatus === "authenticated") {
      const stored = getStoredMode();
      if (stored) setMode(stored);
    }
    if (authStatus !== "loading") {
      setHydrated(true);
    }
    prevAuthStatusRef.current = authStatus;
  }, [authStatus]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode, hydrated]);

  useEffect(() => {
    if (authStatus === "authenticated") fetchPersonaData();
  }, [authStatus, fetchPersonaData]);

  useEffect(() => {
    const onPersonaCreated = () => fetchPersonaData();
    const onAudioSaved = () => fetchPersonaData();
    window.addEventListener("persona-created", onPersonaCreated);
    window.addEventListener("audio-saved", onAudioSaved);
    return () => {
      window.removeEventListener("persona-created", onPersonaCreated);
      window.removeEventListener("audio-saved", onAudioSaved);
    };
  }, [fetchPersonaData]);

  useEffect(() => {
    document.querySelectorAll("audio").forEach((el) => {
      el.pause();
    });
  }, [mode]);

  if (authStatus === "unauthenticated") {
    return (
      <main className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <AppTitleWithLogo className="mb-6" />
          <p className="text-gray-400">
            Generate music, save tracks, create personas, and more. Sign in using the button above.
          </p>
        </div>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <AppTitleWithLogo className="mb-6" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppTitleWithLogo className="mb-6" />

        <div className="mb-6 border-b border-[#2a2a2a]">
          <nav className="-mb-px flex flex-wrap justify-center gap-1" role="tablist" aria-label="Mode">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={mode === opt.value}
                aria-controls={`panel-${opt.value}`}
                id={`tab-${opt.value}`}
                onClick={() => setMode(opt.value)}
                className={
                  mode === opt.value
                    ? "border-b-2 border-blue-500 px-4 py-3 text-sm font-medium text-blue-400"
                    : "border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-400 hover:border-gray-500 hover:text-gray-300"
                }
              >
                {opt.label}
              </button>
            ))}
          </nav>
        </div>

        <SavedTracksList
          selectedFilename={selectedAudioFilename}
          onSelectFilename={mode === "persona" ? handlePersonaTrackSelect : setSelectedAudioFilename}
          showSelection={mode === "persona"}
          personaMetadata={personaTasks}
          personas={personaList}
          showLoadFormRadio={mode === "generate"}
          selectedLoadFormFilename={mode === "generate" ? loadFormSelectedFilename : null}
          onSelectLoadFormFilename={mode === "generate" ? setLoadFormSelectedFilename : undefined}
          showSearch={mode === "generate" || mode === "persona"}
          onNewGeneration={mode === "generate" ? handleNewGeneration : undefined}
        />

        {mode === "persona" && (
          <PersonasList
            personaMetadata={personaTasks}
            personas={personaList}
            personaDataLoading={personaDataLoading}
            selectedViewPersonaId={selectedViewPersonaId}
            onSelectViewPersonaId={handleSelectViewPersona}
          />
        )}

        {mode === "generate" && (
          <>
            <GenerateForm
              statusState={statusState}
              setStatusState={setStatusState}
              loadTaskId={loadFormSelectedFilename ? parseSavedFilename(loadFormSelectedFilename)?.taskId ?? null : null}
              resetKey={formResetKey}
            />
            <GenerationStatus statusState={statusState} />
          </>
        )}
        {mode === "cover" && <CoverSection />}
        {mode === "extend" && <ExtendSection />}
        {mode === "persona" && (
          <CreatePersonaSection
            selectedAudioFilename={selectedAudioFilename}
            personaMetadata={personaTasks}
            personas={personaList}
            selectedViewPersona={
              selectedViewPersonaId
                ? personaList.find((p) => p.personaId === selectedViewPersonaId) ?? null
                : null
            }
          />
        )}
      </div>
    </main>
  );
}
