import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canEditProject } from "@/lib/access";
import { Milestone } from "@/models/milestone";
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
  const milestone = await Milestone.findById(id).lean();

  if (!milestone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (milestone.projectId) {
    if (!(await canEditProject(session, new mongoose.Types.ObjectId(milestone.projectId)))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};
  if (typeof body?.title === "string") updates.title = body.title;
  if (typeof body?.status === "string") updates.status = body.status;
  if (body?.dueDate) updates.dueDate = body.dueDate;
  if (typeof body?.achievements === "string") updates.achievements = body.achievements;
  if (typeof body?.plan === "string") updates.plan = body.plan;
  if (Array.isArray(body?.linkedExperimentIds)) {
    updates.linkedExperimentIds = body.linkedExperimentIds;
  }
  if (Array.isArray(body?.linkedFileIds)) {
    updates.linkedFileIds = body.linkedFileIds;
  }
  if (typeof body?.parentId === "string" || body?.parentId === null) {
    updates.parentId = body.parentId
      ? new mongoose.Types.ObjectId(body.parentId)
      : null;
  }
  if (typeof body?.includeInGlobal === "boolean") {
    updates.includeInGlobal = body.includeInGlobal;
  }
  if (typeof body?.icon === "string") updates.icon = body.icon;
  if (typeof body?.color === "string") updates.color = body.color;
  if (typeof body?.order === "number") updates.order = body.order;
  if (typeof body?.projectId === "string" || body?.projectId === null) {
    if (body.projectId) {
      const nextProjectId = new mongoose.Types.ObjectId(body.projectId);
      if (!(await canEditProject(session, nextProjectId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      updates.projectId = nextProjectId;
    } else {
      updates.projectId = null;
    }
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

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;

  const updated = await Milestone.findByIdAndUpdate(id, updateDoc, {
    new: true,
  }).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "Milestone",
      entityId: new mongoose.Types.ObjectId(id),
      projectId: milestone.projectId
        ? new mongoose.Types.ObjectId(milestone.projectId)
        : undefined,
      previous: milestone as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}

async function collectDescendantIds(rootId: mongoose.Types.ObjectId) {
  const result: mongoose.Types.ObjectId[] = [];
  const queue: mongoose.Types.ObjectId[] = [rootId];

  while (queue.length) {
    const current = queue.shift()!;
    const children = await Milestone.find({
      parentId: current,
      archivedAt: { $exists: false },
    })
      .select("_id")
      .lean();

    for (const child of children) {
      result.push(child._id);
      queue.push(child._id);
    }
  }

  return result;
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
  const milestone = await Milestone.findById(id).lean();

  if (!milestone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (milestone.projectId) {
    if (!(await canEditProject(session, new mongoose.Types.ObjectId(milestone.projectId)))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(_request.url);
  const cascade = searchParams.get("cascade") === "1";
  const reparent = searchParams.get("reparent") === "1";

  const rootObjectId = new mongoose.Types.ObjectId(id);
  const idsToArchive: mongoose.Types.ObjectId[] = [rootObjectId];

  if (cascade) {
    const descendantIds = await collectDescendantIds(rootObjectId);
    idsToArchive.push(...descendantIds);
  }

  if (!cascade && reparent) {
    const newParentId = milestone.parentId ?? null;
    await Milestone.updateMany(
      { parentId: rootObjectId },
      { parentId: newParentId }
    );
  }

  const timestamp = new Date();
  await Milestone.updateMany(
    { _id: { $in: idsToArchive } },
    { archivedAt: timestamp }
  );

  await logUpdate({
    actorId: session.user.id,
    entityType: "Milestone",
    entityId: rootObjectId,
    projectId: milestone.projectId
      ? new mongoose.Types.ObjectId(milestone.projectId)
      : undefined,
    previous: milestone as Record<string, unknown>,
    next: {
      archivedAt: timestamp,
      cascade,
      archivedCount: idsToArchive.length,
    },
  });

  return NextResponse.json({
    ok: true,
    cascade,
    archivedCount: idsToArchive.length,
  });
}
