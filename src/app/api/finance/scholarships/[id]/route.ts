import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { ScholarshipPayment } from "@/models/scholarship-payment";
import { logUpdate } from "@/lib/audit";

function normalizePeriod(period?: string | null, paidAt?: Date | null) {
  if (period) return period;
  if (paidAt) {
    const year = paidAt.getUTCFullYear();
    const month = String(paidAt.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return undefined;
}

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
  const paymentId = new mongoose.Types.ObjectId(id);
  const previous = await ScholarshipPayment.findById(paymentId).lean();
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

  if (body?.paidAt) {
    const paidAt = new Date(body.paidAt);
    updates.paidAt = paidAt;
    updates.period = normalizePeriod(body?.period, paidAt);
  } else if (body?.period) {
    updates.period = body.period;
  }

  if (typeof body?.grossAmount === "number") updates.grossAmount = body.grossAmount;
  if (typeof body?.netAmount === "number") updates.netAmount = body.netAmount;
  if (typeof body?.taxAmount === "number") updates.taxAmount = body.taxAmount;
  if (typeof body?.currency === "string") updates.currency = body.currency;
  if (typeof body?.notes === "string") updates.notes = body.notes;

  if (
    updates.grossAmount !== undefined &&
    updates.netAmount !== undefined &&
    updates.taxAmount === undefined
  ) {
    const gross = Number(updates.grossAmount);
    const net = Number(updates.netAmount);
    updates.taxAmount = Math.max(0, gross - net);
  }

  if (Object.keys(updates).length === 0 && Object.keys(unset).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const updateDoc =
    Object.keys(unset).length > 0 ? { $set: updates, $unset: unset } : updates;
  const updated = await ScholarshipPayment.findByIdAndUpdate(
    paymentId,
    updateDoc,
    { new: true }
  ).lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "ScholarshipPayment",
      entityId: paymentId,
      previous: previous as Record<string, unknown>,
      next: { ...updates, ...nextForLog },
    });
  }

  return NextResponse.json(updated);
}
