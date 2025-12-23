import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { Milestone } from "@/models/milestone";
import { FieldVersion } from "@/models/field-version";

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
  const milestone = await Milestone.findById(id).lean();

  if (!milestone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (milestone.projectId) {
    const allowed = await canAccessProject(
      session,
      new mongoose.Types.ObjectId(milestone.projectId)
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const versions = await FieldVersion.find({
    entityType: "Milestone",
    entityId: new mongoose.Types.ObjectId(id),
  })
    .sort({ changedAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json(versions);
}
