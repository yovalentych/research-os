import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { Grant } from "@/models/grant";
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
  const body = await request.json();

  await connectToDatabase();
  const grantId = new mongoose.Types.ObjectId(id);
  const previous = await Grant.findById(grantId).lean();
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  if (typeof body?.title === "string") updates.title = body.title;
  if (typeof body?.status === "string") updates.status = body.status;
  if (typeof body?.organization === "string") updates.organization = body.organization;
  if (typeof body?.country === "string") updates.country = body.country;
  if (typeof body?.description === "string") updates.description = body.description;
  if (typeof body?.documents === "string") updates.documents = body.documents;
  if (typeof body?.notes === "string") updates.notes = body.notes;
  if (typeof body?.amount === "number") updates.amount = body.amount;
  if (typeof body?.currency === "string") updates.currency = body.currency;
  if (body?.deadlineAt !== undefined) {
    updates.deadlineAt = body.deadlineAt ? new Date(body.deadlineAt) : null;
  }
  if (body?.plannedSubmissionAt !== undefined) {
    updates.plannedSubmissionAt = body.plannedSubmissionAt
      ? new Date(body.plannedSubmissionAt)
      : null;
  }

  if (Object.keys(updates).length === 0 && Object.keys(unset).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;
  const updated = await Grant.findByIdAndUpdate(grantId, updateDoc, {
    new: true,
  }).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "Grant",
      entityId: grantId,
      previous: previous as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}
