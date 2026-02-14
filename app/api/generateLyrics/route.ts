import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { getCallbackUrl } from "@/lib/api-callback";
import { validateRequired } from "@/lib/validation";

const KIE_BASE = "https://api.kie.ai/api/v1";
const MAX_WORDS = 200;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type GenerateLyricsBody = {
  prompt: string;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json(
      { error: "Sign in to generate lyrics" },
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

  let body: GenerateLyricsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const promptError = validateRequired(body, ["prompt"], "Prompt is required");
  if (promptError) return promptError;

  const prompt = (body.prompt ?? "").trim();
  const wordCount = countWords(prompt);
  if (wordCount > MAX_WORDS) {
    return NextResponse.json(
      { error: `Prompt must be at most ${MAX_WORDS} words (currently ${wordCount})` },
      { status: 422 }
    );
  }

  const res = await fetch(`${KIE_BASE}/lyrics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      callBackUrl: getCallbackUrl(),
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

  const taskId =
    data?.data &&
    typeof data.data === "object" &&
    data.data !== null &&
    "taskId" in data.data
      ? (data.data as { taskId?: string }).taskId
      : undefined;

  if (!taskId) {
    return NextResponse.json(
      { error: "No taskId in response", code: parsed.apiCode },
      { status: 502 }
    );
  }

  return NextResponse.json({ taskId });
}
