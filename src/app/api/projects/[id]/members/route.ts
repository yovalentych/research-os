import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";
import { User } from "@/models/user";
import { logCreate, logDelete } from "@/lib/audit";

function canManageMembers(role?: string) {
  return role === "Owner" || role === "Supervisor" || role === "Mentor";
}

export async function GET(
  _request: Request,
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

  const memberships = await Membership.find({ projectId }).lean();
  const userIds = memberships.map((membership) => membership.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("fullName email globalRole")
    .lean();

  return NextResponse.json(
    memberships.map((membership) => {
      const user = users.find((entry) =>
        entry._id.equals(membership.userId)
      );
      return {
        _id: membership._id.toString(),
        projectId: membership.projectId.toString(),
        userId: membership.userId.toString(),
        role: membership.role,
        user: user
          ? {
              _id: user._id.toString(),
              fullName: user.fullName,
              email: user.email,
              globalRole: user.globalRole,
            }
          : null,
      };
    })
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMembers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { userId, role } = body ?? {};

  if (!userId || !role) {
    return NextResponse.json(
      { error: "userId and role are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  const project = await Project.findById(projectId).lean();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = await Membership.findOneAndUpdate(
    { projectId, userId },
    { projectId, userId, role, invitedBy: session.user.id },
    { upsert: true, new: true }
  ).lean();

  await logCreate({
    actorId: session.user.id,
    entityType: "Membership",
    entityId: membership._id,
    projectId,
  });

  return NextResponse.json({
    _id: membership._id.toString(),
    projectId: membership.projectId.toString(),
    userId: membership.userId.toString(),
    role: membership.role,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMembers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { userId } = body ?? {};

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  const deleted = await Membership.findOneAndDelete({ projectId, userId }).lean();
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logDelete({
    actorId: session.user.id,
    entityType: "Membership",
    entityId: deleted._id,
    projectId,
  });

  return NextResponse.json({ ok: true });
}
