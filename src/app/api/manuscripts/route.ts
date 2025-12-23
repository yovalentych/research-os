import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { canEditProject, isElevatedRole } from "@/lib/access";
import { Manuscript } from "@/models/manuscript";
import { ManuscriptSection } from "@/models/manuscript-section";
import { Membership } from "@/models/membership";
import { Project } from "@/models/project";
import { logCreate } from "@/lib/audit";

const sectionTemplates = [
  "Вступ",
  "Методи",
  "Результати",
  "Обговорення",
  "Висновки",
  "Експерименти",
  "Фігури",
];

type SectionInput = {
  sectionType?: string;
  name?: string;
  include?: boolean;
  order?: number;
};

function resolveSections(body: Record<string, unknown> | null) {
  const sectionsInput = Array.isArray(body?.sections)
    ? (body.sections as SectionInput[])
    : null;
  if (sectionsInput?.length) {
    return sectionsInput
      .filter((section) => section?.include !== false)
      .map((section, index) => ({
        sectionType:
          typeof section?.sectionType === "string"
            ? section.sectionType
            : typeof section?.name === "string"
            ? section.name
            : `Секція ${index + 1}`,
        order: typeof section?.order === "number" ? section.order : index,
      }));
  }
  return sectionTemplates.map((section, index) => ({
    sectionType: section,
    order: index,
  }));
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const archiveFilter = buildArchiveFilter(searchParams);

  let projectIds: mongoose.Types.ObjectId[] = [];
  if (isElevatedRole(session.user.role)) {
    const projects = await Project.find().select("_id").lean();
    projectIds = projects.map((project) => project._id);
  } else {
    const memberships = await Membership.find({ userId: session.user.id })
      .select("projectId")
      .lean();
    const owned = await Project.find({ ownerId: session.user.id })
      .select("_id")
      .lean();
    projectIds = [
      ...memberships.map((m) => m.projectId),
      ...owned.map((p) => p._id),
    ];
  }

  const filters: Record<string, unknown> = { ...archiveFilter };
  const accessOr: Record<string, unknown>[] = [];
  if (projectIds.length) {
    accessOr.push({ projectId: { $in: projectIds } });
  }
  accessOr.push(
    isElevatedRole(session.user.role)
      ? { projectId: null }
      : { projectId: null, createdBy: session.user.id }
  );

  const manuscripts = await Manuscript.find({
    ...filters,
    $or: accessOr,
  })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(manuscripts);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown> | null;
  const { projectId, title, type, summary, deadlineAt, targetJournal, status } =
    body ?? {};

  if (!title || !type) {
    return NextResponse.json(
      { error: "title and type are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  let projectObjectId: mongoose.Types.ObjectId | null = null;
  if (typeof projectId === "string" && projectId.trim()) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }
    projectObjectId = new mongoose.Types.ObjectId(projectId);
    if (!(await canEditProject(session, projectObjectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const manuscript = await Manuscript.create({
    projectId: projectObjectId ?? undefined,
    title,
    type,
    status: typeof status === "string" ? status : "draft",
    summary: typeof summary === "string" ? summary : "",
    deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
    targetJournal: typeof targetJournal === "string" ? targetJournal : "",
    createdBy: session.user.id,
  });

  const resolvedSections = resolveSections(body);
  await ManuscriptSection.insertMany(
    resolvedSections.map((section) => ({
      manuscriptId: manuscript._id,
      sectionType: section.sectionType,
      content: "",
      order: section.order ?? 0,
    }))
  );

  await logCreate({
    actorId: session.user.id,
    entityType: "Manuscript",
    entityId: manuscript._id,
    projectId: projectObjectId ?? undefined,
  });

  return NextResponse.json(manuscript);
}
