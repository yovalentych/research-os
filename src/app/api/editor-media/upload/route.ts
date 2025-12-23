import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
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

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const projectId = formData.get("projectId")?.toString();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are supported" }, { status: 400 });
    }

    if (projectId) {
      await connectToDatabase();
      const projectObjectId = new mongoose.Types.ObjectId(projectId);
      if (!(await canAccessProject(session, projectObjectId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeFileName(file.name || "image");
    const key = `editor/${session.user.id}/${Date.now()}-${safeName}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
        Metadata: {
          ownerId: session.user.id,
          projectId: projectId ?? "",
        },
      })
    );

    const url = `/api/editor-media/${encodeURIComponent(key)}`;
    return NextResponse.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
