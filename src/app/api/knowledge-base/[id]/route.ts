import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { KnowledgeBaseEntry } from "@/models/knowledge-base-entry";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";
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
  const entryId = new mongoose.Types.ObjectId(id);
  const previous = await KnowledgeBaseEntry.findById(entryId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isElevatedRole(session.user.role)) {
    const isOwner = previous.createdBy?.toString() === session.user.id;
    const isSharedUser = (previous.sharedUserIds ?? []).some(
      (id) => id.toString() === session.user.id
    );
    if (!isOwner && !isSharedUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { ...body, updatedBy: session.user.id };
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
    delete updates.archived;
  }

  if (Array.isArray(body?.sharedProjectIds)) {
    const memberships = await Membership.find({ userId: session.user.id })
      .select("projectId")
      .lean();
    const owned = await Project.find({ ownerId: session.user.id })
      .select("_id")
      .lean();
    const allowedIds = new Set(
      [...memberships.map((m) => m.projectId), ...owned.map((p) => p._id)].map(
        (id) => id.toString()
      )
    );
    updates.sharedProjectIds = body.sharedProjectIds
      .filter((id: string) => allowedIds.has(id))
      .map((id: string) => new mongoose.Types.ObjectId(id));
  }

  if (Array.isArray(body?.sharedUserIds)) {
    updates.sharedUserIds = body.sharedUserIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );
  }

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;

  const updated = await KnowledgeBaseEntry.findByIdAndUpdate(
    entryId,
    updateDoc,
    { new: true }
  ).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "KnowledgeBaseEntry",
      entityId: entryId,
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
  const entryId = new mongoose.Types.ObjectId(id);
  const previous = await KnowledgeBaseEntry.findById(entryId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isElevatedRole(session.user.role)) {
    const isOwner = previous.createdBy?.toString() === session.user.id;
    const isSharedUser = (previous.sharedUserIds ?? []).some(
      (id) => id.toString() === session.user.id
    );
    if (!isOwner && !isSharedUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await KnowledgeBaseEntry.findByIdAndUpdate(
    entryId,
    { archivedAt: new Date(), updatedBy: session.user.id },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "KnowledgeBaseEntry",
    entityId: entryId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
