import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { canAccessProject, canEditProject } from "@/lib/access";
import { ProjectMaterial } from "@/models/project-material";
import { logCreate } from "@/lib/audit";

export async function GET(
  request: Request,
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

  const { searchParams } = new URL(request.url);
  const archiveFilter = buildArchiveFilter(searchParams);

  const materials = await ProjectMaterial.find({ projectId, ...archiveFilter })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(materials);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const projectId = new mongoose.Types.ObjectId(id);

  if (!(await canEditProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, quantity, unit, status } = body ?? {};

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const material = await ProjectMaterial.create({
    projectId,
    name,
    description,
    quantity,
    unit,
    status,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "ProjectMaterial",
    entityId: material._id,
    projectId,
  });

  return NextResponse.json(material);
}
