"use client";

import { GenerateCoverForm } from "./GenerateCoverForm";

type GenerateCoverSectionProps = {
  selectedTrackFilename?: string | null;
  selectedTrackName?: string | null;
  onClearSelection?: () => void;
};

export function GenerateCoverSection({
  selectedTrackFilename,
  selectedTrackName,
  onClearSelection,
}: GenerateCoverSectionProps) {
  return (
    <GenerateCoverForm
      selectedTrackFilename={selectedTrackFilename}
      selectedTrackName={selectedTrackName}
      onClearSelection={onClearSelection}
    />
  );
}
