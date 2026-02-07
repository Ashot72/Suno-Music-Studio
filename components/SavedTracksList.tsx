"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StyledAudioPlayer } from "@/components/StyledAudioPlayer";
import type { PersonaTaskMeta, SavedPersona } from "@/app/types";

/** Parse filename like taskId-1-title.mp3 into { taskId, index, title } or null. Exported for persona selection. */
export function parseSavedFilename(filename: string): { taskId: string; index: number; title: string } | null {
  const base = filename.replace(/\.mp3$/i, "");
  const parts = base.split("-");
  if (parts.length < 3) return null;
  const [taskId, indexStr, ...titleParts] = parts;
  const index = parseInt(indexStr!, 10);
  if (Number.isNaN(index)) return null;
  const title = titleParts.join("-").replace(/_/g, " ").trim() || "Untitled";
  return { taskId, index, title };
}

/** Group files by taskId; each group has { title, files: [{ filename, index }] } */
function groupSavedFiles(files: string[]): { title: string; files: { filename: string; index: number }[] }[] {
  const byTask: Record<string, { title: string; files: { filename: string; index: number }[] }> = {};
  const ungrouped: { filename: string }[] = [];
  for (const filename of files) {
    const parsed = parseSavedFilename(filename);
    if (!parsed) {
      ungrouped.push({ filename });
      continue;
    }
    if (!byTask[parsed.taskId]) {
      byTask[parsed.taskId] = { title: parsed.title, files: [] };
    }
    byTask[parsed.taskId].files.push({ filename, index: parsed.index });
  }
  for (const key of Object.keys(byTask)) {
    byTask[key].files.sort((a, b) => a.index - b.index);
  }
  const groups = Object.values(byTask);
  if (ungrouped.length > 0) {
    groups.push({
      title: "Other",
      files: ungrouped.map(({ filename }) => ({ filename, index: 0 })),
    });
  }
  return groups;
}

export function trackLabel(index: number): string {
  if (index === 1) return "First Track";
  if (index === 2) return "Second Track";
  return `Track ${index}`;
}

const INITIAL_TRACKS = 4;
const LOAD_MORE_TRACKS = 5;

type GroupWithFiles = { title: string; files: { filename: string; index: number }[] };

/** Flatten groups into [ { groupKey, group, file } ] then slice and regroup for pagination. */
function flattenAndRegroup(
  groups: GroupWithFiles[],
  visibleCount: number
): { groupKey: string; group: GroupWithFiles; files: { filename: string; index: number }[] }[] {
  const flattened: { groupKey: string; group: GroupWithFiles; file: { filename: string; index: number } }[] = [];
  for (const group of groups) {
    const groupKey = group.title + group.files.map((f) => f.filename).join(",");
    for (const file of group.files) {
      flattened.push({ groupKey, group, file });
    }
  }
  const visible = flattened.slice(0, visibleCount);
  const byKey: Record<string, { groupKey: string; group: GroupWithFiles; files: { filename: string; index: number }[] }> = {};
  for (const { groupKey, group, file } of visible) {
    if (!byKey[groupKey]) byKey[groupKey] = { groupKey, group, files: [] };
    byKey[groupKey].files.push(file);
  }
  return Object.values(byKey);
}

const SELECT_BTN_BASE =
  "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]";
export const SELECT_BTN_SELECTED = `${SELECT_BTN_BASE} border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;
export const SELECT_BTN_UNSELECTED = `${SELECT_BTN_BASE} border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:ring-blue-500`;
export const DELETE_BTN_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-900/50 bg-red-950/30 text-red-400 transition-colors hover:border-red-600/50 hover:bg-red-950/50 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-50";

type SavedTracksListProps = {
  selectedFilename?: string | null;
  onSelectFilename?: (filename: string | null) => void;
  showSelection?: boolean;
  /** When provided (e.g. from page), used instead of fetching; avoids duplicate requests. */
  personaMetadata?: Record<string, PersonaTaskMeta> | null;
  personas?: SavedPersona[];
  /** When true, show a select button before delete to choose which track loads the generation form. */
  showLoadFormRadio?: boolean;
  /** Selected track filename for loading form (single selection). */
  selectedLoadFormFilename?: string | null;
  onSelectLoadFormFilename?: (filename: string | null) => void;
  /** When true, show a search input that filters tracks by generation fields (prompt, style, title, etc.). */
  showSearch?: boolean;
  /** Called when user clicks "New Generation" — resets form, pauses all audio, scrolls to form. */
  onNewGeneration?: () => void;
};

/** When showSelection is true, only include vocal files (exclude instrumental tracks). */
function filterVocalTracks(
  files: string[],
  tasks: Record<string, PersonaTaskMeta> | null
): string[] {
  if (!tasks) return [];
  return files.filter((filename) => {
    const parsed = parseSavedFilename(filename);
    if (!parsed) return false;
    const task = tasks[parsed.taskId];
    if (!task) return false;
    if (task.instrumental === true) return false;
    const track = task.tracks?.[parsed.index - 1];
    return Boolean(track?.id);
  });
}

/** True if this filename's track (taskId + audioId from metadata) already has a persona. */
function trackHasPersona(
  filename: string,
  tasks: Record<string, PersonaTaskMeta> | null,
  personas: SavedPersona[]
): boolean {
  if (!tasks || personas.length === 0) return false;
  const parsed = parseSavedFilename(filename);
  if (!parsed) return false;
  const task = tasks[parsed.taskId];
  const track = task?.tracks?.[parsed.index - 1];
  const audioId = track?.id?.trim();
  if (!audioId) return false;
  return personas.some((p) => p.taskId === parsed.taskId && p.audioId === audioId);
}

/** True if this track is instrumental (task-level flag or no audioId in metadata). */
function isInstrumentalTrack(
  filename: string,
  tasks: Record<string, PersonaTaskMeta> | null
): boolean {
  if (!tasks) return false;
  const parsed = parseSavedFilename(filename);
  if (!parsed) return false;
  const task = tasks[parsed.taskId];
  if (!task) return false;
  if (task.instrumental === true) return true;
  const track = task.tracks?.[parsed.index - 1];
  return Boolean(track && !track.id);
}

export function SavedTracksList({
  selectedFilename: controlledFilename,
  onSelectFilename,
  showSelection = false,
  personaMetadata: personaMetadataProp,
  personas: personasProp,
  showLoadFormRadio = false,
  selectedLoadFormFilename = null,
  onSelectLoadFormFilename,
  showSearch = false,
  onNewGeneration,
}: SavedTracksListProps) {
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [filenameToDelete, setFilenameToDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [visibleTrackCount, setVisibleTrackCount] = useState(INITIAL_TRACKS);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollToSectionAfterUpdate = useRef(false);
  const [internalFilename, setInternalFilename] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTaskIds, setSearchTaskIds] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const selectedFilename = controlledFilename !== undefined ? controlledFilename : internalFilename;
  const setSelectedFilename = onSelectFilename ?? setInternalFilename;

  const tasksEffective = personaMetadataProp ?? null;
  const personasEffective = personasProp ?? [];

  const filesToShow = useMemo(
    () => (showSelection ? filterVocalTracks(savedFiles, tasksEffective) : savedFiles),
    [showSelection, savedFiles, tasksEffective]
  );
  const searchFilteredFiles = useMemo(() => {
    if (searchTaskIds === null) return filesToShow;
    return filesToShow.filter((filename) => {
      const parsed = parseSavedFilename(filename);
      return parsed !== null && searchTaskIds.includes(parsed.taskId);
    });
  }, [filesToShow, searchTaskIds]);
  const groups = useMemo(() => groupSavedFiles(searchFilteredFiles), [searchFilteredFiles]);
  const totalTrackCount = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.files.length, 0);
  }, [groups]);
  const visibleGroups = useMemo(
    () => flattenAndRegroup(groups, visibleTrackCount),
    [groups, visibleTrackCount]
  );
  const hasMoreTracks = visibleTrackCount < totalTrackCount;

  const fetchSavedFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/audio", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.files)) {
        setSavedFiles(data.files);
      }
    } catch {
      setSavedFiles([]);
    }
  }, []);

  useEffect(() => {
    fetchSavedFiles();
  }, [fetchSavedFiles]);

  useEffect(() => {
    const onSaved = async () => {
      setCollapsed(false);
      scrollToSectionAfterUpdate.current = true;
      await fetchSavedFiles();
    };
    window.addEventListener("audio-saved", onSaved);
    return () => window.removeEventListener("audio-saved", onSaved);
  }, [fetchSavedFiles]);

  useEffect(() => {
    if (!scrollToSectionAfterUpdate.current) return;
    scrollToSectionAfterUpdate.current = false;
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [savedFiles]);

  useEffect(() => {
    if (!showSearch) return;
    const q = debouncedSearchQuery.trim();
    if (!q) {
      setSearchTaskIds(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/generate/search?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const ids = Array.isArray(data.taskIds) ? data.taskIds : [];
        setSearchTaskIds(ids);
      } catch {
        if (!cancelled) setSearchTaskIds([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSearch, debouncedSearchQuery]);

  useEffect(() => {
    if (showSelection && searchFilteredFiles.length === 0 && onSelectFilename) {
      onSelectFilename(null);
    }
  }, [showSelection, searchFilteredFiles, onSelectFilename]);

  const handleConfirmDelete = useCallback(async () => {
    const filename = filenameToDelete;
    if (!filename) return;
    setFilenameToDelete(null);
    setDeletingFilename(filename);
    try {
      const res = await fetch(`/api/audio?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedFiles((prev) => prev.filter((f) => f !== filename));
      }
    } finally {
      setDeletingFilename(null);
    }
  }, [filenameToDelete]);

  const openDeleteDialog = useCallback((filename: string) => {
    setFilenameToDelete(filename);
  }, []);

  return (
    <section ref={sectionRef} className="mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center justify-center gap-2 rounded text-lg font-semibold text-gray-200 hover:text-gray-100 focus:outline-none"
          aria-expanded={!collapsed}
        >
          Suno Audio Folder
          <span
            className={`inline-block shrink-0 text-gray-500 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {onNewGeneration && (
          <button
            type="button"
            onClick={onNewGeneration}
            className="absolute right-0 flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]"
            title="Reset form and start a new generation"
            aria-label="New Generation"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Generation
          </button>
        )}
      </div>
      <div className={collapsed ? "hidden" : "mt-4"}>
        {showSearch && (
          <div className="mb-4">
            {isSearching && (
              <div className="mb-2 flex items-center justify-center gap-2 text-sm text-gray-400">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500"
                  aria-hidden
                />
                <span>Searching…</span>
              </div>
            )}
            <label htmlFor="suno-folder-search" className="sr-only">
              Search by prompt, style, title, negative tags
            </label>
            <input
              id="suno-folder-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt, style, title..."
              autoComplete="off"
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-[#f5f5f5] placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search by prompt, style, title, negative tags"
            />
          </div>
        )}
        {(showSelection ? filesToShow.length === 0 : savedFiles.length === 0) ? (
          <p className="text-sm text-gray-500">
            {showSelection
              ? "No tracks with vocals to select."
              : "No saved tracks yet. Generate music and use Download to save files."}
          </p>
        ) : searchFilteredFiles.length === 0 ? (
          <p className="text-sm text-gray-500">
            No tracks match your search. Try a different prompt, style, or title.
          </p>
        ) : (
          <div className="space-y-6">
            {visibleGroups.map(({ groupKey, group, files: groupFiles }) => {
              const isGroupCollapsed = collapsedGroups.has(groupKey);
              return (
              <div key={groupKey}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupKey)) next.delete(groupKey);
                      else next.add(groupKey);
                      return next;
                    })
                  }
                  className="mb-2 flex w-full items-center gap-2 rounded-md py-1 text-left text-base font-medium text-gray-200 transition-colors hover:text-gray-100 focus:outline-none"
                  aria-expanded={!isGroupCollapsed}
                  aria-controls={`group-${groupKey.replace(/[^a-z0-9]/gi, "-")}`}
                >
                  <span
                    className="shrink-0 text-gray-500 transition-transform"
                    aria-hidden
                  >
                    {isGroupCollapsed ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{group.title}</span>
                </button>
                <ul
                  id={`group-${groupKey.replace(/[^a-z0-9]/gi, "-")}`}
                  className="space-y-3"
                  hidden={isGroupCollapsed}
                >
                  {groupFiles.map(({ filename, index }) => {
                    const parsed = parseSavedFilename(filename);
                    const taskId = parsed?.taskId ?? null;
                    const instrumental = isInstrumentalTrack(filename, tasksEffective);
                    return (
                      <li
                        key={filename}
                        className="flex flex-nowrap items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4"
                      >
                        <span className="flex min-w-[7.5rem] shrink-0 items-center gap-1.5 text-sm text-gray-400">
                          {group.title === "Other" ? filename.replace(/\.mp3$/i, "") : trackLabel(index)}
                          {instrumental && (
                            <span
                              className="inline-flex shrink-0 text-amber-500"
                              title="Instrumental"
                              aria-label="Instrumental"
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                              </svg>
                            </span>
                          )}
                        </span>
                      <StyledAudioPlayer
                        className="min-w-[360px] flex-1"
                        src={`/api/audio/stream?filename=${encodeURIComponent(filename)}`}
                        preload="metadata"
                        downloadFilename={filename}
                        aria-label={`Play ${parsed?.title ?? filename}`}
                      />
                      {showSelection ? (
                        trackHasPersona(filename, tasksEffective, personasEffective) ? (
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-gray-500 opacity-60"
                            aria-label="Persona already created for this track"
                            title="Persona already created"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={selectedFilename === filename ? SELECT_BTN_SELECTED : SELECT_BTN_UNSELECTED}
                            onClick={() => onSelectFilename?.(filename)}
                            title={selectedFilename === filename ? "Selected" : "Select this track"}
                            aria-label={selectedFilename === filename ? "Selected" : "Select this track"}
                          >
                            {selectedFilename === filename ? (
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                              </svg>
                            )}
                          </button>
                        )
                      ) : (
                        <>
                          {showLoadFormRadio && taskId && (
                            <button
                              type="button"
                              className={selectedLoadFormFilename === filename ? SELECT_BTN_SELECTED : SELECT_BTN_UNSELECTED}
                              onClick={() => onSelectLoadFormFilename?.(filename)}
                              title={selectedLoadFormFilename === filename ? "Load form (selected)" : "Select to load form"}
                              aria-label={selectedLoadFormFilename === filename ? "Load form (selected)" : "Select to load form"}
                            >
                              {selectedLoadFormFilename === filename ? (
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
                            disabled={deletingFilename === filename}
                            onClick={() => openDeleteDialog(filename)}
                            className={DELETE_BTN_CLASS}
                            title="Delete track"
                            aria-label={deletingFilename === filename ? "Deleting…" : "Delete track"}
                          >
                            {deletingFilename === filename ? (
                              <span className="text-xs">…</span>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </>
                      )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
            })}
            {hasMoreTracks && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setVisibleTrackCount((prev) => prev + LOAD_MORE_TRACKS)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
                  title="Load more"
                  aria-label="Load more"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={filenameToDelete !== null}
        onClose={() => setFilenameToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={
          filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
            ? "Track connected to Persona"
            : "Delete Track"
        }
        message={
          filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
            ? "This track is connected to a persona. Delete the persona first."
            : "Are you sure you want to delete this track? It will be removed from the audio folder."
        }
        confirmLabel="Delete"
        cancelLabel={
          filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
            ? "Close"
            : "Cancel"
        }
        variant={
          filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
            ? "default"
            : "danger"
        }
        hideConfirm={
          filenameToDelete !== null && trackHasPersona(filenameToDelete, tasksEffective, personasEffective)
        }
      />
    </section>
  );
}
