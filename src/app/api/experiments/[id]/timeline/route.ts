import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { Experiment } from "@/models/experiment";
import { AuditLog } from "@/models/audit-log";
import { FieldVersion } from "@/models/field-version";
import { User } from "@/models/user";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid experiment id" }, { status: 400 });
  }

  await connectToDatabase();
  const experimentId = new mongoose.Types.ObjectId(id);
  const experiment = await Experiment.findById(experimentId).lean();
  if (!experiment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canAccessProject(
    session,
    new mongoose.Types.ObjectId(experiment.projectId)
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 30), 100);

  const logs = await AuditLog.find({
    entityType: "Experiment",
    entityId: experimentId,
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  const actorIds = Array.from(new Set(logs.map((log) => log.actorId.toString())));
  const actors = await User.find({ _id: { $in: actorIds } })
    .select("_id fullName email")
    .lean();
  const actorMap = new Map(
    actors.map((actor) => [actor._id.toString(), actor])
  );

  const enriched = await Promise.all(
    logs.map(async (log) => {
      const actor = actorMap.get(log.actorId.toString());
      const windowStart = new Date(log.timestamp.getTime() - 2000);
      const windowEnd = new Date(log.timestamp.getTime() + 2000);
      const changes = await FieldVersion.find({
        entityType: log.entityType,
        entityId: log.entityId,
        changedAt: { $gte: windowStart, $lte: windowEnd },
      })
        .sort({ changedAt: -1 })
        .lean();

      return {
        ...log,
        actor: actor
          ? { id: actor._id.toString(), name: actor.fullName, email: actor.email }
          : null,
        changes,
      };
    })
  );

  return NextResponse.json({ items: enriched });
}
