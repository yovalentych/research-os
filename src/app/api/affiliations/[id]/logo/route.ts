import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { r2Client } from "@/lib/r2";
import { Affiliation } from "@/models/affiliation";
import { logUpdate } from "@/lib/audit";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isElevatedRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();
    const affiliationId = new mongoose.Types.ObjectId(id);
    const previous = await Affiliation.findById(affiliationId).lean();

    if (!previous) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `affiliations/${id}/${Date.now()}-${sanitizeFileName(file.name)}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
        Metadata: { affiliationId: id },
      })
    );

    const updates = { emblemStorage: { bucket: R2_BUCKET, key } };
    const updated = await Affiliation.findByIdAndUpdate(
      affiliationId,
      updates,
      { new: true }
    ).lean();

    await logUpdate({
      actorId: session.user.id,
      entityType: "Affiliation",
      entityId: affiliationId,
      previous: previous as Record<string, unknown>,
      next: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
