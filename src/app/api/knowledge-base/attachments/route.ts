import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { KnowledgeBaseAttachment } from "@/models/knowledge-base-attachment";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") === "1";

  await connectToDatabase();
  const attachments = await KnowledgeBaseAttachment.find(
    archived ? { archivedAt: { $exists: true } } : { archivedAt: { $exists: false } }
  )
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(attachments);
}
