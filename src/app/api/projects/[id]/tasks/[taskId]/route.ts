import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canEditProject } from "@/lib/access";
import { ProjectTask } from "@/models/project-task";
import { logUpdate } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId: taskIdParam } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskId = new mongoose.Types.ObjectId(taskIdParam);
  const previous = await ProjectTask.findById(taskId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};
  if (typeof body?.title === "string") updates.title = body.title;
  if (typeof body?.status === "string") updates.status = body.status;
  if (typeof body?.assigneeId === "string")
    updates.assigneeId = body.assigneeId;
  if (typeof body?.assigneeName === "string")
    updates.assigneeName = body.assigneeName;
  if (typeof body?.notes === "string") updates.notes = body.notes;
  if (body?.dueDate) updates.dueDate = body.dueDate;
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

  const updated = await ProjectTask.findByIdAndUpdate(taskId, updateDoc, {
    new: true,
  }).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "ProjectTask",
      entityId: taskId,
      projectId,
      previous: previous as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId: taskIdParam } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskId = new mongoose.Types.ObjectId(taskIdParam);
  const previous = await ProjectTask.findById(taskId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await ProjectTask.findByIdAndUpdate(
    taskId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "ProjectTask",
    entityId: taskId,
    projectId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
