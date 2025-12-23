import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { FileItem } from "@/models/file-item";
import { r2Client } from "@/lib/r2";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  await connectToDatabase();
  const file = await FileItem.findById(fileId).lean();
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const projectId = new mongoose.Types.ObjectId(file.projectId);
  if (!(await canAccessProject(session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: file.storage?.key,
  });
  const url = await getSignedUrl(r2Client, command, { expiresIn: 600 });

  return NextResponse.json({ url });
}
