import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User, GLOBAL_ROLES } from "@/models/user";
import { logDelete, logUpdate } from "@/lib/audit";

function isOwner(role?: string) {
  return role === "Owner";
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOwner(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, globalRole, password } = body ?? {};

  await connectToDatabase();
  const userId = new mongoose.Types.ObjectId(params.id);
  const previous = await User.findById(userId).lean();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof fullName === "string" && fullName.trim()) {
    updates.fullName = fullName.trim();
  }
  if (GLOBAL_ROLES.includes(globalRole)) {
    updates.globalRole = globalRole;
  }
  if (typeof password === "string" && password.length >= 6) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const updated = await User.findByIdAndUpdate(userId, updates, { new: true })
    .select("-passwordHash")
    .lean();

  if (updated) {
    await logUpdate({
      actorId: session.user.id,
      entityType: "User",
      entityId: userId,
      previous: previous as Record<string, unknown>,
      next: updates,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOwner(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const userId = new mongoose.Types.ObjectId(params.id);

  if (session.user.id === userId.toString()) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const deleted = await User.findByIdAndDelete(userId).lean();
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logDelete({
    actorId: session.user.id,
    entityType: "User",
    entityId: userId,
  });

  return NextResponse.json({ ok: true });
}
