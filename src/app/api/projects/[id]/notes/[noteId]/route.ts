import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canEditProject } from "@/lib/access";
import { ProjectNote } from "@/models/project-note";
import { logUpdate } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, noteId: noteIdParam } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const noteId = new mongoose.Types.ObjectId(noteIdParam);
  const previous = await ProjectNote.findById(noteId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    updates.title = body.title;
  }
  if (typeof body?.body === "string") {
    updates.body = body.body;
  }
  if (typeof body?.archived === "boolean") {
    if (body.archived) {
      updates.archivedAt = new Date();
      nextForLog.archivedAt = updates.archivedAt;
    } else {
      unset.archivedAt = "";
      nextForLog.archivedAt = null;
    }
  }

  if (Object.keys(updates).length === 0 && Object.keys(unset).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;

  const updated = await ProjectNote.findByIdAndUpdate(noteId, updateDoc, {
    new: true,
  }).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "ProjectNote",
      entityId: noteId,
      projectId,
      previous: previous as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, noteId: noteIdParam } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const noteId = new mongoose.Types.ObjectId(noteIdParam);
  const previous = await ProjectNote.findById(noteId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await ProjectNote.findByIdAndUpdate(
    noteId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "ProjectNote",
    entityId: noteId,
    projectId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
