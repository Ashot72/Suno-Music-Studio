import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const musicTaskId = request.nextUrl.searchParams.get("taskId");
  if (!musicTaskId?.trim()) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const generation = await prisma.generation.findFirst({
    where: { userId: token.sub, taskId: musicTaskId.trim() },
    orderBy: { createdAt: "desc" },
    select: { coverImages: true, coverTaskId: true },
  });

  if (!generation || !generation.coverImages?.length) {
    return NextResponse.json({ hasCover: false });
  }

  return NextResponse.json({
    hasCover: true,
    coverImages: generation.coverImages,
    coverTaskId: generation.coverTaskId ?? undefined,
  });
}
