import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject, isElevatedRole } from "@/lib/access";
import { FileItem } from "@/models/file-item";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  await connectToDatabase();

  if (projectId) {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    if (!(await canAccessProject(session, projectObjectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const files = await FileItem.find({
      projectId: projectObjectId,
      archivedAt: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(files);
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

  const files = await FileItem.find({
    projectId: { $in: projectIds },
    archivedAt: { $exists: false },
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(files);
}
