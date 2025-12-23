import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { AuditLog } from "@/models/audit-log";
import { FieldVersion } from "@/models/field-version";
import { User } from "@/models/user";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const action = searchParams.get("action") ?? "";
  const entityType = searchParams.get("entityType") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const actorId = searchParams.get("actorId") ?? "";
  const query = searchParams.get("q") ?? "";

  await connectToDatabase();

  const filters: Record<string, unknown> = {};
  if (action) {
    filters.action = action;
  }
  if (entityType) {
    filters.entityType = entityType;
  }
  if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
    filters.projectId = new mongoose.Types.ObjectId(projectId);
  }
  if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
    filters.actorId = new mongoose.Types.ObjectId(actorId);
  }

  if (query) {
    const trimmed = query.trim();
    const orFilters: Record<string, unknown>[] = [
      { entityType: { $regex: trimmed, $options: "i" } },
    ];
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      orFilters.push({ entityId: new mongoose.Types.ObjectId(trimmed) });
    }

    const users = await User.find({
      $or: [
        { fullName: { $regex: trimmed, $options: "i" } },
        { email: { $regex: trimmed, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    if (users.length) {
      orFilters.push({ actorId: { $in: users.map((user) => user._id) } });
    }
    filters.$or = orFilters;
  }

  const total = await AuditLog.countDocuments(filters);
  const logs = await AuditLog.find(filters)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
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

  return NextResponse.json({
    items: enriched,
    total,
    page,
    limit,
  });
}
