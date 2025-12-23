import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canEditProject } from "@/lib/access";
import { VaultFolder } from "@/models/vault-folder";
import { logUpdate } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const folderId = new mongoose.Types.ObjectId(id);
  const previous = await VaultFolder.findById(folderId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (previous.projectId) {
    if (!(await canEditProject(session, new mongoose.Types.ObjectId(previous.projectId)))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};

  if (typeof body?.name === "string") updates.name = body.name;
  if (typeof body?.description === "string") updates.description = body.description;
  if (typeof body?.color === "string") updates.color = body.color;
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

  const updated = await VaultFolder.findByIdAndUpdate(folderId, updateDoc, {
    new: true,
  }).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "VaultFolder",
      entityId: folderId,
      projectId: previous.projectId
        ? new mongoose.Types.ObjectId(previous.projectId)
        : undefined,
      previous: previous as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const folderId = new mongoose.Types.ObjectId(id);
  const previous = await VaultFolder.findById(folderId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (previous.projectId) {
    if (!(await canEditProject(session, new mongoose.Types.ObjectId(previous.projectId)))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await VaultFolder.findByIdAndUpdate(
    folderId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "VaultFolder",
    entityId: folderId,
    projectId: previous.projectId
      ? new mongoose.Types.ObjectId(previous.projectId)
      : undefined,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
