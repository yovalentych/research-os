import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth";
import { r2Client } from "@/lib/r2";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const r2Key = key.map(decodeURIComponent).join("/");
  if (!r2Key.startsWith("editor/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
      })
    );
    const body = response.Body;
    if (!body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const stream =
      body instanceof Readable ? Readable.toWeb(body) : (body as ReadableStream);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": response.ContentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
