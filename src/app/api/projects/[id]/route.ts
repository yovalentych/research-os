import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Project } from "@/models/project";
import { canAccessProject, isElevatedRole } from "@/lib/access";
import { logUpdate } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  const allowed = await canAccessProject(session, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "1";

  const project = await Project.findById(projectId).lean();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.archivedAt && !includeArchived) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

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
  const projectId = new mongoose.Types.ObjectId(id);

  const allowed = await canAccessProject(session, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const previous = await Project.findById(projectId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { ...body };
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

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;

  const updated = await Project.findByIdAndUpdate(projectId, updateDoc, {
    new: true,
  }).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "Project",
      entityId: projectId,
      projectId,
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

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const { id } = await params;
  const projectId = new mongoose.Types.ObjectId(id);

  const previous = await Project.findById(projectId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await Project.findByIdAndUpdate(
    projectId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "Project",
    entityId: projectId,
    projectId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
