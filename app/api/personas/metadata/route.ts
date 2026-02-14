import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PersonaTaskMeta, PersonaTrackMeta } from "@/app/types";

export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      where: { taskId: { not: "" } },
      orderBy: [{ taskId: "asc" }, { index: "asc" }],
    });
    const tasks: Record<string, PersonaTaskMeta> = {};
    for (const t of tracks) {
      if (!tasks[t.taskId]) {
        tasks[t.taskId] = { taskId: t.taskId, tracks: [], createdAt: t.createdAt.toISOString() };
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
        select: {
          taskId: true,
          instrumental: true,
          isExtension: true,
          uploadUrl: true,
          isUploadCover: true,
          isAddInstrumental: true,
          isAddVocals: true,
          isSeparateVocals: true,
          isMashup: true,
          coverImages: true,
        },
      });
      for (const g of generations) {
        if (tasks[g.taskId]) {
          tasks[g.taskId].instrumental = g.instrumental;
          if (g.isExtension) {
            tasks[g.taskId].isExtension = true;
            if (g.uploadUrl && !g.isUploadCover) tasks[g.taskId].isUploadExtension = true;
            if (g.isUploadCover) tasks[g.taskId].isUploadCover = true;
          }
          if (g.isAddInstrumental) tasks[g.taskId].isAddInstrumental = true;
          if (g.isAddVocals) tasks[g.taskId].isAddVocals = true;
          if (g.isSeparateVocals) tasks[g.taskId].isSeparateVocals = true;
          if (g.isMashup) tasks[g.taskId].isMashup = true;
          if (g.coverImages && g.coverImages.length > 0) tasks[g.taskId].hasCoverImage = true;
        }
      }
    }
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: {} });
  }
}
