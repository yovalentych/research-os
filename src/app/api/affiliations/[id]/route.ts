import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { Affiliation } from "@/models/affiliation";
import { logUpdate } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  const affiliationId = new mongoose.Types.ObjectId(id);
  const previous = await Affiliation.findById(affiliationId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
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

  const updated = await Affiliation.findByIdAndUpdate(
    affiliationId,
    updateDoc,
    { new: true }
  ).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "Affiliation",
      entityId: affiliationId,
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

  const { id } = await params;
  await connectToDatabase();
  const affiliationId = new mongoose.Types.ObjectId(id);
  const previous = await Affiliation.findById(affiliationId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await Affiliation.findByIdAndUpdate(
    affiliationId,
    { archivedAt: new Date() },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "Affiliation",
    entityId: affiliationId,
    previous: previous as Record<string, unknown>,
    next: { archivedAt: updated?.archivedAt ?? new Date() },
  });

  return NextResponse.json(updated);
}
