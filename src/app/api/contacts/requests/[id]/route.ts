import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ContactRequest } from "@/models/contact-request";
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  const body = await request.json();
  const { status } = body ?? {};
  if (status !== "accepted" && status !== "declined") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await connectToDatabase();
  const requestId = new mongoose.Types.ObjectId(id);
  const existing = await ContactRequest.findById(requestId).lean();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.recipientId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await ContactRequest.findByIdAndUpdate(
    requestId,
    { status },
    { new: true }
  ).lean();

  await logUpdate({
    actorId: session.user.id,
    entityType: "ContactRequest",
    entityId: requestId,
    previous: existing as Record<string, unknown>,
    next: { status },
  });

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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  await connectToDatabase();
  const requestId = new mongoose.Types.ObjectId(id);
  const existing = await ContactRequest.findById(requestId).lean();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.requesterId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ContactRequest.findByIdAndDelete(requestId);

  await logUpdate({
    actorId: session.user.id,
    entityType: "ContactRequest",
    entityId: requestId,
    previous: existing as Record<string, unknown>,
    next: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
