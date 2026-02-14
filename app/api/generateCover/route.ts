import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getCoverCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { downloadAndSaveCoverImages } from "@/lib/cover-images";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type GenerateCoverBody = {
  taskId: string;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to generate cover" },
      { status: 401 }
    );
  }

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: GenerateCoverBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validationError = validateRequired(body, ["taskId"], "taskId is required");
  if (validationError) return validationError;

  const musicTaskId = (body.taskId ?? "").trim();
  if (!musicTaskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  // Verify user owns a Generation with this taskId
  const generation = await prisma.generation.findFirst({
    where: { userId: token.sub, taskId: musicTaskId },
    orderBy: { createdAt: "desc" },
  });
  const trackWithGen = await prisma.track.findFirst({
    where: { taskId: musicTaskId },
    include: { generation: true },
  });
  const hasAccess = generation || (trackWithGen?.generation?.userId === token.sub);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Track not found or access denied" },
      { status: 404 }
    );
  }
  const genToUse = generation ?? trackWithGen?.generation;

  const res = await fetch(`${KIE_BASE}/suno/cover/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId: musicTaskId,
      callBackUrl: getCoverCallbackUrl(),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  // 400 = cover already generated for this task; response may include existing taskId
  if (res.status === 400 && data?.data && typeof data.data === "object" && "taskId" in data.data) {
    const existingCoverTaskId = (data.data as { taskId?: string }).taskId;
    if (existingCoverTaskId) {
      // Fetch cover details to return images
      const detailRes = await fetch(
        `${KIE_BASE}/suno/cover/record-info?taskId=${encodeURIComponent(existingCoverTaskId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      const detailData = (await detailRes.json().catch(() => ({}))) as Record<string, unknown>;
      const apiData = detailData?.data && typeof detailData.data === "object" ? (detailData.data as Record<string, unknown>) : null;
      const nestedResponse = apiData?.response && typeof apiData.response === "object" ? (apiData.response as { images?: string[] }) : null;
      const images = Array.isArray(nestedResponse?.images) ? nestedResponse.images : null;
      const parentTaskId = typeof apiData?.parentTaskId === "string" ? apiData.parentTaskId : musicTaskId;

      let coverImages: string[] = [];
      if (genToUse && images?.length) {
        try {
          coverImages = await downloadAndSaveCoverImages(parentTaskId, images, apiKey);
          await prisma.generation.update({
            where: { id: genToUse.id },
            data: {
              coverTaskId: existingCoverTaskId,
              ...(coverImages.length > 0 && { coverImages }),
            },
          });
        } catch {
          await prisma.generation.update({
            where: { id: genToUse.id },
            data: { coverTaskId: existingCoverTaskId },
          });
        }
      }

      return NextResponse.json({
        coverTaskId: existingCoverTaskId,
        existing: true,
        images: images ?? [],
        coverImages: coverImages.length > 0 ? coverImages : undefined,
        parentTaskId,
      });
    }
  }

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const coverTaskId =
    data?.data &&
    typeof data.data === "object" &&
    data.data !== null &&
    "taskId" in data.data
      ? (data.data as { taskId?: string }).taskId
      : undefined;

  if (!coverTaskId) {
    return NextResponse.json(
      { error: "No cover taskId in response", code: parsed.apiCode },
      { status: 502 }
    );
  }

  // Store coverTaskId so we can update with images when callback/poll completes
  if (genToUse) {
    await prisma.generation.update({
      where: { id: genToUse.id },
      data: { coverTaskId },
    });
  }

  return NextResponse.json({ coverTaskId });
}
