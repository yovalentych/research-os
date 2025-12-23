import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Manuscript } from "@/models/manuscript";
import { ManuscriptSection } from "@/models/manuscript-section";
import { ManuscriptSectionVersion } from "@/models/manuscript-section-version";
import { logUpdate } from "@/lib/audit";
import { getManuscriptProjectId, hasManuscriptAccess } from "@/lib/manuscript-access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const manuscript = await Manuscript.findById(id).lean();

  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await hasManuscriptAccess(session, manuscript, { requireEdit: true }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { sections } = body ?? {};

  if (!Array.isArray(sections)) {
    return NextResponse.json({ error: "sections is required" }, { status: 400 });
  }

  await Promise.all(
    sections.map(
      async (section: {
        _id: string;
        content?: string;
        linkedExperimentIds?: string[];
        linkedFileIds?: string[];
      }) => {
        const previous = await ManuscriptSection.findById(section._id).lean();
        await ManuscriptSection.findByIdAndUpdate(section._id, {
          content: section.content ?? "",
          linkedExperimentIds: section.linkedExperimentIds ?? [],
          linkedFileIds: section.linkedFileIds ?? [],
        });
        if (previous) {
          await ManuscriptSectionVersion.create({
            sectionId: previous._id,
            content: previous.content ?? "",
            linkedExperimentIds: previous.linkedExperimentIds ?? [],
            linkedFileIds: previous.linkedFileIds ?? [],
            changedBy: session.user.id,
          });
        }
      }
    )
  );

  await logUpdate({
    actorId: session.user.id,
    entityType: "ManuscriptSection",
    entityId: new mongoose.Types.ObjectId(id),
    projectId: getManuscriptProjectId(manuscript) ?? undefined,
    previous: {},
    next: { updated: sections.length },
  });

  return NextResponse.json({ ok: true });
}
