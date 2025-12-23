import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Manuscript } from "@/models/manuscript";
import { ManuscriptSection } from "@/models/manuscript-section";
import { logUpdate } from "@/lib/audit";
import { getManuscriptProjectId, hasManuscriptAccess } from "@/lib/manuscript-access";

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
  const manuscript = await Manuscript.findById(id).lean();

  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await hasManuscriptAccess(session, manuscript);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "1";
  if (manuscript.archivedAt && !includeArchived) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sections = await ManuscriptSection.find({ manuscriptId: manuscript._id })
    .sort({ order: 1, updatedAt: -1 })
    .lean();

  return NextResponse.json({ manuscript, sections });
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
  const manuscript = await Manuscript.findById(id).lean();

  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await hasManuscriptAccess(session, manuscript, { requireEdit: true }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const nextForLog: Record<string, unknown> = {};
  if (typeof body?.title === "string") updates.title = body.title;
  if (typeof body?.type === "string") updates.type = body.type;
  if (typeof body?.status === "string") updates.status = body.status;
  if (typeof body?.summary === "string") updates.summary = body.summary;
  if (typeof body?.targetJournal === "string")
    updates.targetJournal = body.targetJournal;
  if (typeof body?.deadlineAt === "string") {
    updates.deadlineAt = new Date(body.deadlineAt);
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

  const updated = await Manuscript.findByIdAndUpdate(id, updateDoc, {
    new: true,
  }).lean();

  const projectObjectId = getManuscriptProjectId(manuscript);
  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "Manuscript",
      entityId: new mongoose.Types.ObjectId(id),
      projectId: projectObjectId ?? undefined,
      previous: manuscript as Record<string, unknown>,
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
  const manuscript = await Manuscript.findById(id).lean();

  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await hasManuscriptAccess(session, manuscript, { requireEdit: true }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await Manuscript.findByIdAndUpdate(
    id,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  const projectObjectId = getManuscriptProjectId(manuscript);
  await logUpdate({
    actorId: session.user.id,
    entityType: "Manuscript",
    entityId: new mongoose.Types.ObjectId(id),
    projectId: projectObjectId ?? undefined,
    previous: manuscript as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
