import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { validateRequired } from "@/lib/validation";

const KIE_BASE = "https://api.kie.ai/api/v1";

export type GetLyricsBody = {
  taskId: string;
  audioId: string;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to get lyrics" },
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

  let body: GetLyricsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { taskId, audioId } = body;

  const validationError = validateRequired(body, ["taskId", "audioId"]);
  if (validationError) return validationError;

  const res = await fetch(`${KIE_BASE}/generate/get-timestamped-lyrics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId: taskId.trim(),
      audioId: audioId.trim(),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const lyricsData = data?.data;
  return NextResponse.json(lyricsData ?? {});
}
