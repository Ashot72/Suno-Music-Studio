"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InfoHint } from "@/components/shared/InfoHint";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import {
  trackLabel,
  SELECT_BTN_SELECTED,
  SELECT_BTN_UNSELECTED,
  DELETE_BTN_CLASS,
} from "@/components/SavedTracksList";
import type { SavedPersona, PersonaTaskMeta } from "@/app/types";

type PersonasListProps = {
  /** When provided (e.g. from page), used instead of fetching. */
  personaMetadata?: Record<string, PersonaTaskMeta> | null;
  personas?: SavedPersona[];
  /** When true and data from parent, show Loading until parent fetch completes. */
  personaDataLoading?: boolean;
  selectedViewPersonaId?: string | null;
  onSelectViewPersonaId?: (personaId: string | null) => void;
};

export function PersonasList({
  personaMetadata: personaMetadataProp,
  personas: personasProp,
  personaDataLoading: parentLoading = false,
  selectedViewPersonaId = null,
  onSelectViewPersonaId,
}: PersonasListProps = {}) {
  const [personas, setPersonas] = useState<SavedPersona[]>([]);
  const [tasks, setTasks] = useState<Record<string, PersonaTaskMeta>>({});
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState<string | null>(null);
  const [deletingPersonaId, setDeletingPersonaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const hasDataFromParent = personasProp !== undefined;
  const loadingEffective = hasDataFromParent ? parentLoading : loading;

  const tasksEffective = personaMetadataProp ?? tasks;
  const personasEffective = personasProp ?? personas;
  const filteredPersonas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return personasEffective;
    return personasEffective.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [personasEffective, searchQuery]);

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const [personasRes, metadataRes] = await Promise.all([
        fetch("/api/personas"),
        fetch("/api/personas/metadata"),
      ]);
      const personasData = await personasRes.json();
      const metadataData = await metadataRes.json();
      if (personasRes.ok && Array.isArray(personasData.personas)) {
        setPersonas(personasData.personas);
      } else {
        setPersonas([]);
      }
      if (metadataRes.ok && metadataData.tasks && typeof metadataData.tasks === "object") {
        setTasks(metadataData.tasks);
      } else {
        setTasks({});
      }
    } catch {
      setPersonas([]);
      setTasks({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasDataFromParent) return;
    fetchPersonas();
  }, [hasDataFromParent, fetchPersonas]);

  useEffect(() => {
    if (hasDataFromParent) return;
    const onCreated = () => fetchPersonas();
    window.addEventListener("persona-created", onCreated);
    return () => window.removeEventListener("persona-created", onCreated);
  }, [hasDataFromParent, fetchPersonas]);

  const resolveTrack = useCallback(
    (taskId: string, audioId: string): { audio_url: string } | null => {
      const task = tasksEffective[taskId];
      if (!task?.tracks) return null;
      const track = task.tracks.find((t) => t.id === audioId);
      if (!track) return null;
      return { audio_url: track.audio_url ?? "" };
    },
    [tasksEffective]
  );

  /** 1-based track number from persona-metadata (task.tracks index where id === audioId). */
  const resolveTrackNumber = useCallback(
    (taskId: string, audioId: string): number | null => {
      const task = tasksEffective[taskId];
      if (!task?.tracks) return null;
      const index = task.tracks.findIndex((t) => t.id === audioId);
      return index >= 0 ? index + 1 : null;
    },
    [tasksEffective]
  );

  const handleConfirmDelete = useCallback(async () => {
    const personaId = personaToDelete;
    if (!personaId) return;
    setPersonaToDelete(null);
    setDeletingPersonaId(personaId);
    try {
      const res = await fetch(`/api/personas?personaId=${encodeURIComponent(personaId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPersonas((prev) => prev.filter((p) => p.personaId !== personaId));
        if (personasProp !== undefined) {
          window.dispatchEvent(new CustomEvent("persona-created"));
        }
      }
    } finally {
      setDeletingPersonaId(null);
    }
  }, [personaToDelete, personasProp]);

  const openDeleteDialog = useCallback((personaId: string) => {
    setPersonaToDelete(personaId);
  }, []);

  return (
    <section className="mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-center gap-2 rounded text-lg font-semibold text-gray-200 hover:text-gray-100 focus:outline-none"
        aria-expanded={!collapsed}
      >
        Personas
        <span
          className={`inline-block shrink-0 text-gray-500 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
          aria-hidden
        >
          ▼
        </span>
      </button>
      <div className={collapsed ? "hidden" : "mt-4"}>
        {!loadingEffective && personasEffective.length > 0 && (
          <div className="mb-4">
            <label htmlFor="personas-search" className="sr-only">
              Search by name or description
            </label>
            <input
              id="personas-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or description..."
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-[#f5f5f5] placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search by name or description"
            />
          </div>
        )}
        {loadingEffective ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : personasEffective.length === 0 ? (
          <p className="text-sm text-gray-500">
            No personas yet. Create one from a track above.
          </p>
        ) : filteredPersonas.length === 0 ? (
          <p className="text-sm text-gray-500">
            No personas match your search. Try a different name or description.
          </p>
        ) : (
          <div className="space-y-6">
            {filteredPersonas.map((p, i) => {
              const audioUrl = p.audio_url ?? resolveTrack(p.taskId, p.audioId)?.audio_url ?? null;
              return (
                <div key={`${p.personaId}-${i}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-medium text-gray-200">{p.name}</h3>
                    <InfoHint
                      text="Description"
                      tooltip={p.description ?? ""}
                      id={`persona-desc-${p.personaId}`}
                      compact
                      tooltipMaxWidth="300px"
                    />
                  </div>
                  <ul className="space-y-3">
                    <li className="flex flex-nowrap items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
                      <span className="w-24 shrink-0 text-sm text-gray-400">
                        {trackLabel(resolveTrackNumber(p.taskId, p.audioId) ?? i + 1)}
                      </span>
                      {audioUrl ? (
                        <StyledAudioPlayer
                          className="min-w-[360px] flex-1"
                          src={audioUrl}
                          preload="metadata"
                          downloadFilename={`${p.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.mp3`}
                          aria-label={`Play ${p.name}`}
                        />
                      ) : (
                        <span className="flex-1 text-xs text-gray-500">No audio</span>
                      )}
                      {onSelectViewPersonaId && (
                        <button
                          type="button"
                          className={selectedViewPersonaId === p.personaId ? SELECT_BTN_SELECTED : SELECT_BTN_UNSELECTED}
                          onClick={() => onSelectViewPersonaId(p.personaId)}
                          title={selectedViewPersonaId === p.personaId ? "Viewing" : "Select to view"}
                          aria-label={selectedViewPersonaId === p.personaId ? "Viewing" : `Select to view ${p.name}`}
                        >
                          {selectedViewPersonaId === p.personaId ? (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                            </svg>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingPersonaId === p.personaId}
                        onClick={() => openDeleteDialog(p.personaId)}
                        className={DELETE_BTN_CLASS}
                        title="Delete persona"
                        aria-label={deletingPersonaId === p.personaId ? "Deleting…" : "Delete persona"}
                      >
                        {deletingPersonaId === p.personaId ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </li>
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={personaToDelete !== null}
        onClose={() => setPersonaToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Persona"
        message="Are you sure you want to delete this persona? It will be removed from the list."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </section>
  );
}
