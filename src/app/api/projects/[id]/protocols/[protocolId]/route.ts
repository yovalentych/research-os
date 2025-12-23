import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canEditProject } from "@/lib/access";
import { ProjectProtocol } from "@/models/project-protocol";
import { logUpdate } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; protocolId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, protocolId: protocolIdParam } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const protocolId = new mongoose.Types.ObjectId(protocolIdParam);
  const previous = await ProjectProtocol.findById(protocolId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};
  if (typeof body?.title === "string") updates.title = body.title;
  if (Array.isArray(body?.steps)) updates.steps = body.steps;
  if (typeof body?.notes === "string") updates.notes = body.notes;
  if (typeof body?.version === "string") updates.version = body.version;
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

  const updated = await ProjectProtocol.findByIdAndUpdate(
    protocolId,
    updateDoc,
    {
      new: true,
    }
  ).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "ProjectProtocol",
      entityId: protocolId,
      projectId,
      previous: previous as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; protocolId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, protocolId: protocolIdParam } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const protocolId = new mongoose.Types.ObjectId(protocolIdParam);
  const previous = await ProjectProtocol.findById(protocolId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await ProjectProtocol.findByIdAndUpdate(
    protocolId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "ProjectProtocol",
    entityId: protocolId,
    projectId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
