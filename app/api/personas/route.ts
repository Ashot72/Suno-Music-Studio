import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import type { SavedPersona } from "@/app/types";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in to list personas" }, { status: 401 });
  }
  try {
    const rows = await prisma.persona.findMany({
      where: { userId: token.sub },
      orderBy: { createdAt: "asc" },
    });
    const personas: SavedPersona[] = rows.map((p) => ({
      personaId: p.personaId,
      name: p.name,
      description: p.description,
      taskId: p.taskId,
      audioId: p.audioId,
      audio_url: p.audio_url ?? undefined,
      createdAt: p.createdAt.toISOString(),
    }));
    return NextResponse.json({ personas });
  } catch {
    return NextResponse.json({ personas: [] });
  }
}

export async function DELETE(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in to delete a persona" }, { status: 401 });
  }
  const personaId = request.nextUrl.searchParams.get("personaId");
  if (!personaId) {
    return NextResponse.json({ error: "personaId required" }, { status: 400 });
  }
  try {
    const result = await prisma.persona.deleteMany({
      where: { personaId, userId: token.sub },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete persona" }, { status: 500 });
  }
}
