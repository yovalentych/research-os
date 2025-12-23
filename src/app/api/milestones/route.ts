import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { canAccessProject, canEditProject, isElevatedRole } from "@/lib/access";
import { Milestone } from "@/models/milestone";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";
import { logCreate } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const archiveFilter = buildArchiveFilter(searchParams);

  await connectToDatabase();

  if (projectId) {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const allowed = await canAccessProject(session, projectObjectId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const milestones = await Milestone.find({
      projectId: projectObjectId,
      ...archiveFilter,
    })
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json(milestones);
  }

  let projectIds: mongoose.Types.ObjectId[] = [];
  if (isElevatedRole(session.user.role)) {
    const projects = await Project.find().select("_id").lean();
    projectIds = projects.map((project) => project._id);
  } else {
    const memberships = await Membership.find({ userId: session.user.id })
      .select("projectId")
      .lean();
    const owned = await Project.find({ ownerId: session.user.id })
      .select("_id")
      .lean();
    projectIds = [
      ...memberships.map((m) => m.projectId),
      ...owned.map((p) => p._id),
    ];
  }

  const milestones = await Milestone.find({
    $or: [
      { projectId: { $in: projectIds } },
      { projectId: { $exists: false } },
      { projectId: null },
    ],
    ...archiveFilter,
  })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(milestones);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    projectId,
    parentId,
    title,
    status,
    dueDate,
    achievements,
    plan,
    linkedExperimentIds,
    linkedFileIds,
    includeInGlobal,
    icon,
    color,
    order,
  } = body ?? {};

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  await connectToDatabase();
  let projectObjectId: mongoose.Types.ObjectId | undefined;

  if (projectId) {
    projectObjectId = new mongoose.Types.ObjectId(projectId);
    if (!(await canEditProject(session, projectObjectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const milestone = await Milestone.create({
    projectId: projectObjectId,
    parentId: parentId ? new mongoose.Types.ObjectId(parentId) : undefined,
    title,
    status,
    dueDate,
    achievements,
    plan,
    linkedExperimentIds,
    linkedFileIds,
    includeInGlobal,
    icon,
    color,
    order,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "Milestone",
    entityId: milestone._id,
    projectId: projectObjectId,
  });

  return NextResponse.json(milestone);
}
