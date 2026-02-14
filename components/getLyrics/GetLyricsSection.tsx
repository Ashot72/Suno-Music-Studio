"use client";

import { GetLyricsForm } from "./GetLyricsForm";

type GetLyricsSectionProps = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  selectedAudioId?: string | null;
  onClearSelection?: () => void;
};

export function GetLyricsSection({
  selectedTrackFilename,
  selectedTrackName,
  selectedAudioId,
  onClearSelection,
}: GetLyricsSectionProps) {
  return (
    <GetLyricsForm
      selectedTrackFilename={selectedTrackFilename}
      selectedTrackName={selectedTrackName}
      selectedAudioId={selectedAudioId}
      onClearSelection={onClearSelection}
    />
  );
}
