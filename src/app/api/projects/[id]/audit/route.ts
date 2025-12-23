import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { AuditLog } from "@/models/audit-log";

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

  const logs = await AuditLog.find({ projectId })
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();

  return NextResponse.json(
    logs.map((log) => ({
      _id: log._id.toString(),
      actorId: log.actorId.toString(),
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId.toString(),
      timestamp: log.timestamp,
    }))
  );
}
