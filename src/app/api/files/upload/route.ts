import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canEditProject } from "@/lib/access";
import { r2Client } from "@/lib/r2";
import { FileItem } from "@/models/file-item";
import { logCreate } from "@/lib/audit";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const projectId = formData.get("projectId")?.toString();
    const entityType = formData.get("entityType")?.toString() ?? "";
    const entityId = formData.get("entityId")?.toString() ?? "";
    const file = formData.get("file");

    if (!projectId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "projectId and file are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    if (!(await canEditProject(session, projectObjectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `${projectId}/${Date.now()}-${sanitizeFileName(file.name)}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
        Metadata: {
          entityType,
          entityId,
        },
      })
    );

    const fileItem = await FileItem.create({
      projectId: projectObjectId,
      entityType,
      entityId,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      storage: { bucket: R2_BUCKET, key },
    });

    await logCreate({
      actorId: session.user.id,
      entityType: "FileItem",
      entityId: fileItem._id,
      projectId: projectObjectId,
    });

    return NextResponse.json(fileItem);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
