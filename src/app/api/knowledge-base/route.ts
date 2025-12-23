import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import mongoose from "mongoose";
import { buildArchiveFilter } from "@/lib/archive";
import { isElevatedRole } from "@/lib/access";
import { KnowledgeBaseEntry } from "@/models/knowledge-base-entry";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";
import { logCreate } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const archiveFilter = buildArchiveFilter(searchParams);
  const visibility = searchParams.get("visibility");
  const category = searchParams.get("category");
  const query = searchParams.get("q");

  await connectToDatabase();

  const filters: Record<string, unknown> = {
    ...archiveFilter,
  };
  if (visibility) filters.visibility = visibility;
  if (category) filters.category = category;
  if (query) {
    filters.$text = { $search: query };
  }

  if (!isElevatedRole(session.user.role)) {
    const memberships = await Membership.find({ userId: session.user.id })
      .select("projectId")
      .lean();
    const owned = await Project.find({ ownerId: session.user.id })
      .select("_id")
      .lean();
    const projectIds = [
      ...memberships.map((m) => m.projectId),
      ...owned.map((p) => p._id),
    ];

    const userObjectId = new mongoose.Types.ObjectId(session.user.id);
    filters.$or = [
      { createdBy: userObjectId },
      { visibility: "shared", sharedProjectIds: { $in: projectIds } },
      { visibility: "shared", sharedUserIds: userObjectId },
    ];
  }

  let queryBuilder = KnowledgeBaseEntry.find(filters);
  if (query) {
    queryBuilder = queryBuilder.sort({ score: { $meta: "textScore" } });
  } else {
    queryBuilder = queryBuilder.sort({ updatedAt: -1 });
  }

  const entries = await queryBuilder.lean();

  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, category, content, tags, visibility, sharedProjectIds } =
    body ?? {};

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  await connectToDatabase();
  const entry = await KnowledgeBaseEntry.create({
    title,
    category,
    content,
    tags,
    visibility,
    sharedProjectIds,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "KnowledgeBaseEntry",
    entityId: entry._id,
  });

  return NextResponse.json(entry);
}
