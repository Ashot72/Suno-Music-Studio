import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadAndSaveCoverImages } from "@/lib/cover-images";

const KIE_BASE = "https://api.kie.ai/api/v1";

/** Handle cover generation completion callback from kie.ai.
 * Returns 200 immediately per docs (15s timeout), then processes async. */
export async function POST(request: NextRequest) {
  let body: { code?: number; msg?: string; data?: { taskId?: string; images?: string[] } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  const { code, data } = body;
  if (code !== 200 || !data?.images?.length || !data.taskId) {
    return NextResponse.json({ status: "received" }, { status: 200 });
  }

  const coverTaskId = data.taskId;
  const images = data.images as string[];

  // Return 200 immediately to avoid 15s timeout; process async
  void processCoverCallback(coverTaskId, images);
  return NextResponse.json({ status: "received" }, { status: 200 });
}

async function processCoverCallback(coverTaskId: string, images: string[]): Promise<void> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(
      `${KIE_BASE}/suno/cover/record-info?taskId=${encodeURIComponent(coverTaskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const infoData = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const apiData = infoData?.data && typeof infoData.data === "object" ? (infoData.data as Record<string, unknown>) : null;
    const parentTaskId = typeof apiData?.parentTaskId === "string" ? apiData.parentTaskId : null;

    if (!parentTaskId) return;

    const generation = await prisma.generation.findFirst({
      where: { taskId: parentTaskId },
      orderBy: { createdAt: "desc" },
    });
    if (!generation) return;

    const coverFilenames = await downloadAndSaveCoverImages(parentTaskId, images, apiKey);
    if (coverFilenames.length > 0) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { coverTaskId, coverImages: coverFilenames },
      });
    }
  } catch {
    // ignore
  }
}
