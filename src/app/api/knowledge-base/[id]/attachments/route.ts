import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { r2Client } from "@/lib/r2";
import { KnowledgeBaseEntry } from "@/models/knowledge-base-entry";
import { KnowledgeBaseAttachment } from "@/models/knowledge-base-attachment";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";
import { logCreate } from "@/lib/audit";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function canViewEntry(
  session: { user: { id: string; role?: string } },
  entry: {
    createdBy?: mongoose.Types.ObjectId;
    visibility?: string;
    sharedProjectIds?: mongoose.Types.ObjectId[];
    sharedUserIds?: mongoose.Types.ObjectId[];
  }
) {
  if (isElevatedRole(session.user.role)) return true;
  if (entry.createdBy?.toString() === session.user.id) return true;
  if ((entry.sharedUserIds ?? []).some((id) => id.toString() === session.user.id)) {
    return true;
  }
  if (entry.visibility !== "shared") return false;

  const memberships = await Membership.find({ userId: session.user.id })
    .select("projectId")
    .lean();
  const owned = await Project.find({ ownerId: session.user.id })
    .select("_id")
    .lean();
  const projectIds = new Set(
    [...memberships.map((m) => m.projectId), ...owned.map((p) => p._id)].map((id) =>
      id.toString()
    )
  );
  return (entry.sharedProjectIds ?? []).some((id) => projectIds.has(id.toString()));
}

export const runtime = "nodejs";

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
  const entry = await KnowledgeBaseEntry.findById(id).lean();

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canViewEntry(session, entry))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachments = await KnowledgeBaseAttachment.find({
    entryId: new mongoose.Types.ObjectId(id),
    archivedAt: { $exists: false },
  })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(attachments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();
    const entry = await KnowledgeBaseEntry.findById(id).lean();
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isElevatedRole(session.user.role)) {
      const isOwner = entry.createdBy?.toString() === session.user.id;
      const isSharedUser = (entry.sharedUserIds ?? []).some(
        (id) => id.toString() === session.user.id
      );
      if (!isOwner && !isSharedUser) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `knowledge-base/${id}/${Date.now()}-${sanitizeFileName(file.name)}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
        Metadata: {
          entryId: id,
        },
      })
    );

    const attachment = await KnowledgeBaseAttachment.create({
      entryId: new mongoose.Types.ObjectId(id),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      storage: { bucket: R2_BUCKET, key },
      createdBy: session.user.id,
    });

    await logCreate({
      actorId: session.user.id,
      entityType: "KnowledgeBaseAttachment",
      entityId: attachment._id,
    });

    return NextResponse.json(attachment);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
