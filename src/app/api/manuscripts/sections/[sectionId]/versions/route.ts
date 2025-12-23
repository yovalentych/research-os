import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Manuscript } from "@/models/manuscript";
import { ManuscriptSection } from "@/models/manuscript-section";
import { ManuscriptSectionVersion } from "@/models/manuscript-section-version";
import { hasManuscriptAccess } from "@/lib/manuscript-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sectionId } = await params;
  await connectToDatabase();

  const section = await ManuscriptSection.findById(sectionId).lean();
  if (!section) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manuscript = await Manuscript.findById(section.manuscriptId).lean();
  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await hasManuscriptAccess(session, manuscript);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const versions = await ManuscriptSectionVersion.find({
    sectionId: new mongoose.Types.ObjectId(sectionId),
  })
    .sort({ changedAt: -1 })
    .limit(10)
    .lean();

  return NextResponse.json(versions);
}
