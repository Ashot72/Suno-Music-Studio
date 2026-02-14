import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKieResponse } from "@/lib/api-error";

const KIE_BASE = "https://api.kie.ai/api/v1";

const FAILED_STATUSES = [
  "ERROR",
  "CREATE_TASK_FAILED",
  "GENERATE_AUDIO_FAILED",
  "CALLBACK_EXCEPTION",
  "SENSITIVE_WORD_ERROR",
];

const COMPLETED_STATUS = "COMPLETED";
const SUCCESS_STATUS = "SUCCESS";

export async function GET(request: NextRequest) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${KIE_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const d = data?.data as Record<string, unknown> | undefined;
  const response = (d?.response ?? {}) as Record<string, unknown>;
  const status = (d?.status ?? (d?.response as Record<string, unknown>)?.status ?? data?.status) as
    | string
    | undefined;
  const rawTracks =
    response.sunoData ?? response.suno_data ?? response.data ?? d?.tracks ?? data?.tracks;
  const tracksFromApi = Array.isArray(rawTracks)
    ? (rawTracks as { id?: string; audioUrl?: string; title?: string }[])
    : undefined;
  /** KIE docs: complete = all tracks done; we also accept COMPLETED, SUCCESS */
  let isCompleted =
    status === COMPLETED_STATUS ||
    status === SUCCESS_STATUS ||
    (typeof status === "string" && status.toLowerCase() === "complete") ||
    (typeof status === "string" && status.toLowerCase() === "success");
  if (
    !isCompleted &&
    Array.isArray(tracksFromApi) &&
    tracksFromApi.length > 0 &&
    tracksFromApi.some((t) => typeof t?.audioUrl === "string" && t.audioUrl.length > 0)
  ) {
    const trackStatuses = tracksFromApi.map(
      (t) => (t as Record<string, unknown>)?.status ?? (t as Record<string, unknown>)?.Status ?? ""
    );
    const anySuccess = trackStatuses.some(
      (s) =>
        s === "SUCCESS" ||
        s === "COMPLETED" ||
        String(s).toLowerCase() === "complete" ||
        String(s).toLowerCase() === "success"
    );
    if (anySuccess) isCompleted = true;
  }
  const isFinal =
    isCompleted ||
    (typeof status === "string" && FAILED_STATUSES.includes(status));

  if (isFinal && Array.isArray(tracksFromApi) && tracksFromApi.length > 0) {
    const generation = await prisma.generation.findFirst({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
    if (generation) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);
      for (let i = 0; i < tracksFromApi.length; i++) {
        const t = tracksFromApi[i];
        const title = typeof t?.title === "string" ? t.title : `Track ${i + 1}`;
        const audioUrl = typeof t?.audioUrl === "string" ? t.audioUrl : null;
        const audioId = typeof t?.id === "string" ? t.id : null;
        const index = i + 1;
        const existing = await prisma.track.findFirst({
          where: { taskId, index },
        });
        if (existing) {
          await prisma.track.update({
            where: { id: existing.id },
            data: { audioUrl, expiresAt, title, audioId },
          });
        } else {
          await prisma.track.create({
            data: {
              generationId: generation.id,
              taskId,
              audioId,
              title,
              index,
              audioUrl,
              expiresAt,
            },
          });
        }
      }
    }
  }

  return NextResponse.json(data);
}
