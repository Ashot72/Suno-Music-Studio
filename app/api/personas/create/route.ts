import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { parseKieResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

const KIE_BASE = "https://api.kie.ai/api/v1";

type PersonaBody = {
  taskId: string;
  audioId: string;
  name: string;
  description: string;
};

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in to create a persona" }, { status: 401 });
  }

  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KIE_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: PersonaBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, audioId, name, description } = body;
  if (!taskId || !audioId || !name || !description) {
    return NextResponse.json(
      { error: "taskId, audioId, name, and description are required" },
      { status: 400 }
    );
  }

  const res = await fetch(`${KIE_BASE}/generate/generate-persona`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId, audioId, name, description }),
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  const parsed = parseKieResponse(res, data);
  if (parsed.isError) {
    return NextResponse.json(
      { error: parsed.errorMessage, code: parsed.apiCode },
      { status: parsed.status }
    );
  }

  const apiCode = parsed.apiCode;
  const dataData = data?.data && typeof data.data === "object" && data.data !== null ? data.data as Record<string, unknown> : undefined;
  const personaId = dataData?.personaId as string | undefined;
  const returnedName = (dataData?.name as string | undefined) ?? name;
  const returnedDescription = (dataData?.description as string | undefined) ?? description;

  if (!personaId) {
    return NextResponse.json(
      { error: "No personaId in response", code: apiCode },
      { status: 502 }
    );
  }

  let audio_url: string | undefined;
  const track = await prisma.track.findFirst({
    where: { taskId, audioId },
  });
  if (track?.audioUrl) audio_url = track.audioUrl;

  await prisma.persona.create({
    data: {
      userId: token.sub,
      personaId,
      name: returnedName,
      description: returnedDescription,
      taskId,
      audioId,
      audio_url: audio_url ?? undefined,
    },
  });

  return NextResponse.json({
    personaId,
    name: returnedName,
    description: returnedDescription,
  });
}
