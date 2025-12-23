import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { Project } from "@/models/project";
import { Membership } from "@/models/membership";
import { isElevatedRole } from "@/lib/access";
import { logCreate } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const archiveFilter = buildArchiveFilter(searchParams);

  if (isElevatedRole(session.user.role)) {
    const projects = await Project.find(archiveFilter)
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json(projects);
  }

  const memberships = await Membership.find({ userId: session.user.id })
    .select("projectId")
    .lean();
  const membershipIds = memberships.map((m) => m.projectId);

  const projects = await Project.find({
    $or: [{ ownerId: session.user.id }, { _id: { $in: membershipIds } }],
    ...archiveFilter,
  })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, status, tags, visibility } = body ?? {};
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  await connectToDatabase();

  const project = await Project.create({
    ownerId: session.user.id,
    title,
    description,
    status,
    tags,
    visibility,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "Project",
    entityId: project._id,
    projectId: project._id,
  });

  return NextResponse.json(project);
}
