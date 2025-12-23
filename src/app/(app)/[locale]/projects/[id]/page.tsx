import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getProjectAccess } from "@/lib/access";
import { Project } from "@/models/project";
import { ProjectMembersPanel } from "@/components/project-members-panel";
import { ProjectMaterialsPanel } from "@/components/project-materials-panel";
import { ProjectNotesPanel } from "@/components/project-notes-panel";
import { ProjectTasksPanel } from "@/components/project-tasks-panel";
import { ProjectProtocolsPanel } from "@/components/project-protocols-panel";
import { ProjectFilesPanel } from "@/components/project-files-panel";
import { ProjectAuditPanel } from "@/components/project-audit-panel";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  await connectToDatabase();
  const project = await Project.findById(id).lean();
  const access = session
    ? await getProjectAccess(session, new mongoose.Types.ObjectId(id))
    : { canEdit: false, canView: false, role: null };
  const canManageMembers =
    session?.user.role === "Owner" ||
    session?.user.role === "Supervisor" ||
    session?.user.role === "Mentor";

  if (!access.canView) {
    return (
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h2 className="text-2xl font-semibold">Доступ обмежений</h2>
        <p className="mt-2 text-sm text-stone-600">
          У вас немає доступу до цього проєкту.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h2 className="text-2xl font-semibold">
          {project?.title ?? "Проєкт"}
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          {project?.description ??
            "Колаборація для експериментів, матеріалів та спільних задач."}
        </p>
      </section>

      <ProjectMembersPanel projectId={id} canManage={Boolean(canManageMembers)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProjectMaterialsPanel projectId={id} canEdit={access.canEdit} />
        <ProjectNotesPanel projectId={id} canEdit={access.canEdit} />
        <ProjectTasksPanel projectId={id} canEdit={access.canEdit} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectProtocolsPanel projectId={id} canEdit={access.canEdit} />
        <ProjectFilesPanel projectId={id} canEdit={access.canEdit} />
      </div>

      <ProjectAuditPanel projectId={id} />
    </div>
  );
}
