import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { canAccessProject } from "@/lib/access";
import { FileItem } from "@/models/file-item";
import { logCreate } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const archiveFilter = buildArchiveFilter(searchParams);

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const projectObjectId = new mongoose.Types.ObjectId(projectId);
  const allowed = await canAccessProject(session, projectObjectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filters: Record<string, unknown> = {
    projectId: projectObjectId,
    ...archiveFilter,
  };

  if (entityType) {
    filters.entityType = entityType;
  }
  if (entityId) {
    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return NextResponse.json(
        { error: "entityId is invalid" },
        { status: 400 }
      );
    }
    filters.entityId = new mongoose.Types.ObjectId(entityId);
  }

  const files = await FileItem.find(filters)
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, entityType, entityId, name, mimeType, size, storage, tags } =
    body ?? {};

  if (!projectId || !name || !storage?.key || !storage?.bucket) {
    return NextResponse.json(
      { error: "projectId, name, storage.key, storage.bucket required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const projectObjectId = new mongoose.Types.ObjectId(projectId);
  const allowed = await canAccessProject(session, projectObjectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileItem = await FileItem.create({
    projectId: projectObjectId,
    entityType,
    entityId,
    name,
    mimeType,
    size,
    storage,
    tags,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "FileItem",
    entityId: fileItem._id,
    projectId: projectObjectId,
  });

  return NextResponse.json(fileItem);
}
