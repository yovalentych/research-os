import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Manuscript } from "@/models/manuscript";
import { ManuscriptSection } from "@/models/manuscript-section";
import { ProjectProtocol } from "@/models/project-protocol";
import { Experiment } from "@/models/experiment";
import { FileItem } from "@/models/file-item";
import { logUpdate } from "@/lib/audit";
import { getManuscriptProjectId, hasManuscriptAccess } from "@/lib/manuscript-access";

function buildMethods(protocols: { title: string; steps?: string[] }[]) {
  if (protocols.length === 0) {
    return "Методи ще не додані. Додайте протоколи проєкту.";
  }

  return protocols
    .map((protocol) => {
      const steps = protocol.steps?.length
        ? protocol.steps.map((step) => `- ${step}`).join("\n")
        : "- Кроки не деталізовані";
      return `${protocol.title}\n${steps}`;
    })
    .join("\n\n");
}

function buildResults(files: { name: string }[]) {
  if (files.length === 0) {
    return "Результати ще не додані. Додайте файли проєкту.";
  }

  return files.map((file) => `- ${file.name}`).join("\n");
}

function buildExperiments(experiments: { title: string; status?: string }[]) {
  if (experiments.length === 0) {
    return "Експерименти ще не додані. Додайте експерименти проєкту.";
  }

  return experiments
    .map((experiment) => `- ${experiment.title} (${experiment.status ?? "—"})`)
    .join("\n");
}

export async function POST(
  _request: Request,
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
  const projectId = getManuscriptProjectId(manuscript);
  if (!projectId) {
    return NextResponse.json(
      { error: "Project-linked manuscript required" },
      { status: 400 }
    );
  }

  const protocols = await ProjectProtocol.find({ projectId })
    .select("title steps")
    .lean();
  const files = await FileItem.find({ projectId, entityType: "Project" })
    .select("name")
    .lean();
  const experiments = await Experiment.find({ projectId })
    .select("title status")
    .lean();

  const methods = buildMethods(protocols);
  const results = buildResults(files);
  const experimentsText = buildExperiments(experiments);

  await ManuscriptSection.updateMany(
    { manuscriptId: manuscript._id, sectionType: "Методи" },
    { content: methods }
  );
  await ManuscriptSection.updateMany(
    { manuscriptId: manuscript._id, sectionType: "Результати" },
    { content: results }
  );
  await ManuscriptSection.updateMany(
    { manuscriptId: manuscript._id, sectionType: "Експерименти" },
    { content: experimentsText }
  );

  await logUpdate({
    actorId: session.user.id,
    entityType: "Manuscript",
    entityId: new mongoose.Types.ObjectId(id),
    projectId,
    previous: {},
    next: { generated: true },
  });

  return NextResponse.json({ ok: true });
}
