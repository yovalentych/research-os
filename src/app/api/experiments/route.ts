import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { Experiment } from "@/models/experiment";
import { canAccessProject } from "@/lib/access";
import { logCreate } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
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

  const experiments = await Experiment.find({
    projectId: projectObjectId,
    ...archiveFilter,
  })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(experiments);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, title, status } = body ?? {};

  if (!projectId || !title) {
    return NextResponse.json(
      { error: "projectId and title are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const projectObjectId = new mongoose.Types.ObjectId(projectId);
  const allowed = await canAccessProject(session, projectObjectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const experiment = await Experiment.create({
    projectId: projectObjectId,
    title,
    status,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "Experiment",
    entityId: experiment._id,
    projectId: projectObjectId,
  });

  return NextResponse.json(experiment);
}
