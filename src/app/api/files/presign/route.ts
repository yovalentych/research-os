import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { r2Client } from "@/lib/r2";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { fileName, contentType, projectId, entityType, entityId } = body ?? {};

  if (!fileName || !contentType || !projectId) {
    return NextResponse.json(
      { error: "fileName, contentType, projectId are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const projectObjectId = new mongoose.Types.ObjectId(projectId);
  const allowed = await canAccessProject(session, projectObjectId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const safeName = sanitizeFileName(fileName);
  const key = `${projectId}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    Metadata: {
      entityType: entityType ?? "",
      entityId: entityId ?? "",
    },
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });

  return NextResponse.json({
    uploadUrl,
    key,
    bucket: R2_BUCKET,
  });
}
