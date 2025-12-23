import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { AuditLog } from "@/models/audit-log";
import { FieldVersion } from "@/models/field-version";

export async function logCreate({
  actorId,
  entityType,
  entityId,
  projectId,
  request,
}: {
  actorId: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  request?: NextRequest;
}) {
  await AuditLog.create({
    actorId,
    action: "create",
    entityType,
    entityId,
    projectId,
    metadata: request
      ? { ip: request.ip, userAgent: request.headers.get("user-agent") }
      : undefined,
  });
}

export async function logDelete({
  actorId,
  entityType,
  entityId,
  projectId,
  request,
}: {
  actorId: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  request?: NextRequest;
}) {
  await AuditLog.create({
    actorId,
    action: "delete",
    entityType,
    entityId,
    projectId,
    metadata: request
      ? { ip: request.ip, userAgent: request.headers.get("user-agent") }
      : undefined,
  });
}

export async function logUpdate({
  actorId,
  entityType,
  entityId,
  projectId,
  request,
  previous,
  next,
}: {
  actorId: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  request?: NextRequest;
  previous: Record<string, unknown>;
  next: Record<string, unknown>;
}) {
  await AuditLog.create({
    actorId,
    action: "update",
    entityType,
    entityId,
    projectId,
    metadata: request
      ? { ip: request.ip, userAgent: request.headers.get("user-agent") }
      : undefined,
  });

  const changes = Object.keys(next)
    .filter((key) => key !== "_id")
    .map((key) => ({
      entityType,
      entityId,
      fieldPath: key,
      oldValue: previous[key],
      newValue: next[key],
      changedBy: actorId,
      changedAt: new Date(),
    }));

  if (changes.length) {
    await FieldVersion.insertMany(changes);
  }
}
