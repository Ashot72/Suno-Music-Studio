"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import type { StatusState, PersonaTaskMeta, SavedPersona } from "@/app/types";
import { SavedTracksList, parseSavedFilename } from "@/components/SavedTracksList";
import { GenerateForm } from "@/components/generate/GenerateForm";
import { GenerationStatus } from "@/components/generate/GenerationStatus";
import { ExtendSection } from "@/components/extend/ExtendSection";
import { UploadExtendSection } from "@/components/uploadExtend/UploadExtendSection";
import { UploadCoverSection } from "@/components/uploadCover/UploadCoverSection";
import { AddInstrumentalSection } from "@/components/addInstrumental/AddInstrumentalSection";
import { AddVocalsSection } from "@/components/addVocals/AddVocalsSection";
import { SeparateVocalsSection } from "@/components/separateVocals/SeparateVocalsSection";
import { MashupSection } from "@/components/mashup/MashupSection";
import { GetLyricsSection } from "@/components/getLyrics/GetLyricsSection";
import { GenerateLyricsSection } from "@/components/generateLyrics/GenerateLyricsSection";
import { GenerateCoverSection } from "@/components/generateCover/GenerateCoverSection";
import { CreatePersonaSection } from "@/components/persona/CreatePersonaSection";
import { PersonasList } from "@/components/persona/PersonasList";
import { AppTitleWithLogo } from "@/components/shared/AppTitle";

export type AppMode = "generate" | "mashup" | "extend" | "uploadExtend" | "uploadCover" | "addInstrumental" | "addVocals" | "separateVocals" | "persona" | "getLyrics" | "generateLyrics" | "generateCover";

const MODE_OPTIONS: { value: AppMode; label: string }[] = [
  { value: "generate", label: "Generate Music" },
  { value: "extend", label: "Extend Music" },
  { value: "uploadExtend", label: "Upload & Extend Music" },
  { value: "uploadCover", label: "Upload & Cover Music" },
  { value: "addInstrumental", label: "Add Instrumental" },
  { value: "addVocals", label: "Add Vocals" },
  { value: "separateVocals", label: "Separate Vocals" },
  { value: "persona", label: "Generate Persona" },
  { value: "mashup", label: "Mashup" },
  { value: "getLyrics", label: "Get Lyrics" },
  { value: "generateLyrics", label: "Generate Lyrics" },
  { value: "generateCover", label: "Generate Cover" },
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

  const [extendStatusState, setExtendStatusState] = useState<StatusState>(null);
  const [extendResetKey, setExtendResetKey] = useState(0);

  const [uploadExtendStatusState, setUploadExtendStatusState] = useState<StatusState>(null);
  const [uploadExtendResetKey, setUploadExtendResetKey] = useState(0);

  const [uploadCoverStatusState, setUploadCoverStatusState] = useState<StatusState>(null);
  const [uploadCoverResetKey, setUploadCoverResetKey] = useState(0);

  const [addInstrumentalStatusState, setAddInstrumentalStatusState] = useState<StatusState>(null);
  const [addInstrumentalResetKey, setAddInstrumentalResetKey] = useState(0);

  const [addVocalsStatusState, setAddVocalsStatusState] = useState<StatusState>(null);
  const [addVocalsResetKey, setAddVocalsResetKey] = useState(0);

  const [separateVocalsStatusState, setSeparateVocalsStatusState] = useState<StatusState>(null);

  const [mashupStatusState, setMashupStatusState] = useState<StatusState>(null);
  const [mashupResetKey, setMashupResetKey] = useState(0);
  const [mashupSelectingForSlot, setMashupSelectingForSlot] = useState<1 | 2>(1);
  const [mashupSlot1Filename, setMashupSlot1Filename] = useState<string | null>(null);
  const [mashupSlot2Filename, setMashupSlot2Filename] = useState<string | null>(null);

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

  const handleMashupTrackSelect = useCallback(
    (filename: string | null) => {
      if (mashupSelectingForSlot === 1) setMashupSlot1Filename(filename);
      else setMashupSlot2Filename(filename);
    },
    [mashupSelectingForSlot]
  );

  // Resolve audioId from persona metadata for the extend feature
  const resolveAudioId = useCallback(
    (filename: string | null): string | null => {
      if (!filename || !personaTasks) return null;
      const parsed = parseSavedFilename(filename);
      if (!parsed) return null;
      const task = personaTasks[parsed.taskId];
      if (!task) return null;
      const track = task.tracks?.[parsed.index - 1];
      return track?.id ?? null;
    },
    [personaTasks]
  );

  const extendAudioId = resolveAudioId(mode === "extend" ? selectedAudioFilename : null);
  const separateVocalsAudioId = resolveAudioId(mode === "separateVocals" ? selectedAudioFilename : null);
  const getLyricsAudioId = resolveAudioId(mode === "getLyrics" ? selectedAudioFilename : null);

  // Resolve display name for selected track (upload-extend, upload-cover, add-instrumental, add-vocals, separate-vocals, get-lyrics, generate-cover)
  const selectedTrackDisplayName =
    (mode === "uploadExtend" || mode === "uploadCover" || mode === "addInstrumental" || mode === "addVocals" || mode === "separateVocals" || mode === "getLyrics" || mode === "generateCover") &&
    selectedAudioFilename
      ? parseSavedFilename(selectedAudioFilename)?.title ?? selectedAudioFilename
      : null;

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
    const onCoverGenerated = () => fetchPersonaData();
    window.addEventListener("persona-created", onPersonaCreated);
    window.addEventListener("audio-saved", onAudioSaved);
    window.addEventListener("cover-generated", onCoverGenerated);
    return () => {
      window.removeEventListener("persona-created", onPersonaCreated);
      window.removeEventListener("audio-saved", onAudioSaved);
      window.removeEventListener("cover-generated", onCoverGenerated);
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
          selectedFilename={
            mode === "mashup"
              ? (mashupSelectingForSlot === 1 ? mashupSlot1Filename : mashupSlot2Filename)
              : selectedAudioFilename
          }
          onSelectFilename={
            mode === "persona"
              ? handlePersonaTrackSelect
              : mode === "mashup"
                ? handleMashupTrackSelect
                : setSelectedAudioFilename
          }
          selectionMode={
            mode === "persona" ? "persona"
              : mode === "extend" ? "extend"
                : mode === "uploadExtend" ? "uploadExtend"
                  : mode === "uploadCover" ? "uploadCover"
                    : mode === "addInstrumental" ? "addInstrumental"
                      : mode === "addVocals" ? "addVocals"
                        : mode === "separateVocals" ? "separateVocals"
                          : mode === "mashup" ? "mashup"
                            : mode === "getLyrics" ? "getLyrics"
                              : mode === "generateLyrics" ? "generateLyrics"
                              : mode === "generateCover" ? "generateCover"
                              : undefined
          }
          personaMetadata={personaTasks}
          personas={personaList}
          showLoadFormRadio={mode === "generate"}
          selectedLoadFormFilename={mode === "generate" ? loadFormSelectedFilename : null}
          onSelectLoadFormFilename={mode === "generate" ? setLoadFormSelectedFilename : undefined}
          showSearch={mode === "generate" || mode === "mashup" || mode === "persona" || mode === "extend" || mode === "uploadExtend" || mode === "uploadCover" || mode === "addInstrumental" || mode === "addVocals" || mode === "separateVocals" || mode === "getLyrics" || mode === "generateLyrics" || mode === "generateCover"}
          onNewGeneration={
            mode === "generate"
              ? handleNewGeneration
              : undefined
          }
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
        {mode === "mashup" && (
          <MashupSection
            statusState={mashupStatusState}
            setStatusState={setMashupStatusState}
            resetKey={mashupResetKey}
            selectingForSlot={mashupSelectingForSlot}
            onSelectingForSlotChange={setMashupSelectingForSlot}
            slot1SelectedFilename={mashupSlot1Filename}
            slot2SelectedFilename={mashupSlot2Filename}
            slot1SelectedTrackName={
              mashupSlot1Filename ? parseSavedFilename(mashupSlot1Filename)?.title ?? mashupSlot1Filename : null
            }
            slot2SelectedTrackName={
              mashupSlot2Filename ? parseSavedFilename(mashupSlot2Filename)?.title ?? mashupSlot2Filename : null
            }
            onClearSlot1={() => setMashupSlot1Filename(null)}
            onClearSlot2={() => setMashupSlot2Filename(null)}
          />
        )}
        {mode === "extend" && (
          <ExtendSection
            statusState={extendStatusState}
            setStatusState={setExtendStatusState}
            selectedAudioId={extendAudioId}
            loadTaskId={selectedAudioFilename ? parseSavedFilename(selectedAudioFilename)?.taskId ?? null : null}
            personas={personaList}
            resetKey={extendResetKey}
          />
        )}
        <div className={mode === "uploadExtend" ? "" : "hidden"}>
          <UploadExtendSection
            statusState={uploadExtendStatusState}
            setStatusState={setUploadExtendStatusState}
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            onClearSelection={() => setSelectedAudioFilename(null)}
            loadTaskId={selectedAudioFilename ? parseSavedFilename(selectedAudioFilename)?.taskId ?? null : null}
            personas={personaList}
            resetKey={uploadExtendResetKey}
          />
        </div>
        <div className={mode === "uploadCover" ? "" : "hidden"}>
          <UploadCoverSection
            statusState={uploadCoverStatusState}
            setStatusState={setUploadCoverStatusState}
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            onClearSelection={() => setSelectedAudioFilename(null)}
            loadTaskId={selectedAudioFilename ? parseSavedFilename(selectedAudioFilename)?.taskId ?? null : null}
            personas={personaList}
            resetKey={uploadCoverResetKey}
          />
        </div>
        <div className={mode === "addInstrumental" ? "" : "hidden"}>
          <AddInstrumentalSection
            statusState={addInstrumentalStatusState}
            setStatusState={setAddInstrumentalStatusState}
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            onClearSelection={() => setSelectedAudioFilename(null)}
            loadTaskId={selectedAudioFilename ? parseSavedFilename(selectedAudioFilename)?.taskId ?? null : null}
            resetKey={addInstrumentalResetKey}
          />
        </div>
        <div className={mode === "addVocals" ? "" : "hidden"}>
          <AddVocalsSection
            statusState={addVocalsStatusState}
            setStatusState={setAddVocalsStatusState}
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            onClearSelection={() => setSelectedAudioFilename(null)}
            loadTaskId={selectedAudioFilename ? parseSavedFilename(selectedAudioFilename)?.taskId ?? null : null}
            resetKey={addVocalsResetKey}
          />
        </div>
        <div className={mode === "separateVocals" ? "" : "hidden"}>
          <SeparateVocalsSection
            statusState={separateVocalsStatusState}
            setStatusState={setSeparateVocalsStatusState}
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            selectedAudioId={separateVocalsAudioId}
            onClearSelection={() => setSelectedAudioFilename(null)}
          />
        </div>
        {mode === "getLyrics" && (
          <GetLyricsSection
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            selectedAudioId={getLyricsAudioId}
            onClearSelection={() => setSelectedAudioFilename(null)}
          />
        )}
        {mode === "generateLyrics" && <GenerateLyricsSection />}
        {mode === "generateCover" && (
          <GenerateCoverSection
            selectedTrackFilename={selectedAudioFilename}
            selectedTrackName={selectedTrackDisplayName}
            onClearSelection={() => setSelectedAudioFilename(null)}
          />
        )}
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
