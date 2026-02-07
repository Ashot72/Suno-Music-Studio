import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PersonaTaskMeta, PersonaTrackMeta } from "@/app/types";

export async function GET() {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const tracks = await prisma.track.findMany({
      where: {
        taskId: { not: "" },
        createdAt: { gte: fourteenDaysAgo },
      },
      orderBy: [{ taskId: "asc" }, { index: "asc" }],
    });
    const tasks: Record<string, PersonaTaskMeta> = {};
    for (const t of tracks) {
      if (!tasks[t.taskId]) {
        tasks[t.taskId] = { taskId: t.taskId, tracks: [] };
      }
      const meta: PersonaTrackMeta = {
        audio_url: t.audioUrl ?? "",
        title: t.title,
      };
      if (t.audioId) meta.id = t.audioId;
      tasks[t.taskId].tracks.push(meta);
    }
    const taskIds = Object.keys(tasks);
    if (taskIds.length > 0) {
      const generations = await prisma.generation.findMany({
        where: { taskId: { in: taskIds } },
        select: { taskId: true, instrumental: true },
      });
      for (const g of generations) {
        if (tasks[g.taskId]) tasks[g.taskId].instrumental = g.instrumental;
      }
    }
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: {} });
  }
}
