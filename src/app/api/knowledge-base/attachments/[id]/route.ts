import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { KnowledgeBaseAttachment } from "@/models/knowledge-base-attachment";
import { KnowledgeBaseEntry } from "@/models/knowledge-base-entry";
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
  const attachmentId = new mongoose.Types.ObjectId(id);
  const previous = await KnowledgeBaseAttachment.findById(attachmentId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entry = await KnowledgeBaseEntry.findById(previous.entryId).lean();
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isElevatedRole(session.user.role)) {
    if (entry.createdBy?.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};

  if (typeof body?.archived === "boolean") {
    if (body.archived) {
      updates.archivedAt = new Date();
      nextForLog.archivedAt = updates.archivedAt;
    } else {
      unset.archivedAt = "";
      nextForLog.archivedAt = null;
    }
  }

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;

  const updated = await KnowledgeBaseAttachment.findByIdAndUpdate(
    attachmentId,
    updateDoc,
    { new: true }
  ).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "KnowledgeBaseAttachment",
      entityId: attachmentId,
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
  const attachmentId = new mongoose.Types.ObjectId(id);
  const previous = await KnowledgeBaseAttachment.findById(attachmentId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entry = await KnowledgeBaseEntry.findById(previous.entryId).lean();
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isElevatedRole(session.user.role)) {
    if (entry.createdBy?.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await KnowledgeBaseAttachment.findByIdAndUpdate(
    attachmentId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "KnowledgeBaseAttachment",
    entityId: attachmentId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
