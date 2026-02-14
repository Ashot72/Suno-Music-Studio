export type SunoTrack = {
  id: string;
  audioUrl: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  prompt?: string;
  modelName?: string;
  title: string;
  tags?: string;
  createTime?: string;
  duration?: number;
};

export type StatusState = {
  taskId: string;
  status: string;
  tracks: SunoTrack[];
  error?: string;
} | null;

/** In-progress stages: KIE uses text, first; we also accept legacy TEXT_SUCCESS, FIRST_SUCCESS */
export const IN_PROGRESS_STATUSES = ["PENDING", "TEXT_SUCCESS", "FIRST_SUCCESS", "text", "first"] as const;

export const FAILED_STATUSES = [
  "ERROR",
  "CREATE_TASK_FAILED",
  "GENERATE_AUDIO_FAILED",
  "CALLBACK_EXCEPTION",
  "SENSITIVE_WORD_ERROR",
] as const;

/** Track metadata for Persona: id (audioId) optional—present when API returns it, missing for instrumental. */
export type PersonaTrackMeta = {
  id?: string;
  audio_url: string;
  title: string;
};

/** Task-level metadata stored for later Generate Persona use. */
export type PersonaTaskMeta = {
  taskId: string;
  tracks: PersonaTrackMeta[];
  /** True when the generation was instrumental (from Generation.instrumental). */
  instrumental?: boolean;
  /** True when the track was created via Extend Music. */
  isExtension?: boolean;
  /** True when the track was created via Upload & Extend Music. */
  isUploadExtension?: boolean;
  /** True when the track was created via Upload & Cover Music. */
  isUploadCover?: boolean;
  /** True when the track was created via Add Instrumental. */
  isAddInstrumental?: boolean;
  /** True when the track was created via Add Vocals. */
  isAddVocals?: boolean;
  /** True when the track was created via Separate Vocals. */
  isSeparateVocals?: boolean;
  /** True when the track was created via Mashup. */
  isMashup?: boolean;
  /** True when a cover image has been generated for this task. */
  hasCoverImage?: boolean;
  /** ISO date string of when the earliest track in this task was created. */
  createdAt?: string;
};

/** Saved persona entry: API response plus link to source track. */
export type SavedPersona = {
  personaId: string;
  name: string;
  description: string;
  taskId: string;
  audioId: string;
  /** Stored so we can still play audio when the track is removed from metadata */
  audio_url?: string;
  createdAt?: string;
};
