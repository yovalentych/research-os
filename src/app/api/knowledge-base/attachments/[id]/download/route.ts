import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { r2Client } from "@/lib/r2";
import { KnowledgeBaseAttachment } from "@/models/knowledge-base-attachment";
import { KnowledgeBaseEntry } from "@/models/knowledge-base-entry";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
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
  const attachment = await KnowledgeBaseAttachment.findById(id).lean();
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entry = await KnowledgeBaseEntry.findById(attachment.entryId).lean();
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canViewEntry(session, entry))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: attachment.storage?.key,
  });
  const url = await getSignedUrl(r2Client, command, { expiresIn: 600 });

  return NextResponse.json({ url });
}
