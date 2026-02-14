"use client";

/** Callback stages per KIE docs: text (text generation), first (first track), complete (all tracks) */
function getStageMessage(status?: string): { label: string; description: string } {
  const s = status?.toLowerCase();
  switch (s) {
    case "text":
    case "text_success":
      return { label: "Text", description: "Lyrics / text generation completed" };
    case "first":
    case "first_success":
      return { label: "First track", description: "First track generation completed" };
    case "complete":
    case "success":
    case "completed":
      return { label: "Complete", description: "All tracks generated" };
    default:
      return { label: "Pending", description: "Waiting to be processed" };
  }
}

type GenerationProgressProps = {
  isActive: boolean;
  status?: string;
  /** Override label when provided (e.g. for cover: "Pending", "Generating") */
  label?: string;
  /** Override description when provided */
  description?: string;
};

export function GenerationProgress({ isActive, status, label: labelProp, description: descProp }: GenerationProgressProps) {
  if (!isActive) return null;

  const fromStatus = getStageMessage(status);
  const label = labelProp ?? fromStatus.label;
  const description = descProp ?? fromStatus.description;

  return (
    <section className="mb-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div
          className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-blue-500"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-200">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </section>
  );
}
