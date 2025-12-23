import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { canAccessProject, canEditProject } from "@/lib/access";
import { ProjectTask } from "@/models/project-task";
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

  const tasks = await ProjectTask.find({ projectId, ...archiveFilter })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(tasks);
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
  const { title, status, dueDate, assigneeId, assigneeName, notes } = body ?? {};

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const task = await ProjectTask.create({
    projectId,
    title,
    status,
    dueDate,
    assigneeId,
    assigneeName,
    notes,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "ProjectTask",
    entityId: task._id,
    projectId,
  });

  return NextResponse.json(task);
}
