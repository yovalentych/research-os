import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isElevatedRole } from "@/lib/access";
import { AuditLog } from "@/models/audit-log";
import { FieldVersion } from "@/models/field-version";
import { User } from "@/models/user";
import { Project } from "@/models/project";
import { ProjectTask } from "@/models/project-task";
import { Milestone } from "@/models/milestone";
import { Grant } from "@/models/grant";

const UPCOMING_DAYS = 7;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);

  await connectToDatabase();

  const logs = await AuditLog.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  const actorIds = Array.from(new Set(logs.map((log) => log.actorId.toString())));
  const actors = await User.find({ _id: { $in: actorIds } })
    .select("_id fullName email")
    .lean();
  const actorMap = new Map(
    actors.map((actor) => [actor._id.toString(), actor])
  );

  const auditItems = logs.map((log) => ({
    id: log._id.toString(),
    type: "audit",
    title: `${log.action.toUpperCase()} · ${log.entityType}`,
    timestamp: log.timestamp,
    actor: actorMap.get(log.actorId.toString()) ?? null,
  }));

  const now = new Date();
  const upcoming = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);

  const [
    projects,
    milestones,
    tasks,
    overdueMilestones,
    overdueTasks,
    grantDeadlines,
    overdueGrants,
    statusChanges,
  ] = await Promise.all([
    Project.find().select("_id title").lean(),
    Milestone.find({
      archivedAt: { $exists: false },
      status: { $ne: "done" },
      dueDate: { $lte: upcoming },
    })
      .select("_id title dueDate projectId")
      .lean(),
    ProjectTask.find({
      archivedAt: { $exists: false },
      status: { $ne: "done" },
      dueDate: { $lte: upcoming },
    })
      .select("_id title dueDate projectId")
      .lean(),
    Milestone.find({
      archivedAt: { $exists: false },
      status: { $ne: "done" },
      dueDate: { $lt: now },
    })
      .select("_id title dueDate projectId")
      .lean(),
    ProjectTask.find({
      archivedAt: { $exists: false },
      status: { $ne: "done" },
      dueDate: { $lt: now },
    })
      .select("_id title dueDate projectId")
      .lean(),
    Grant.find({
      archivedAt: { $exists: false },
      status: { $ne: "closed" },
      deadlineAt: { $lte: upcoming },
    })
      .select("_id title deadlineAt")
      .lean(),
    Grant.find({
      archivedAt: { $exists: false },
      status: { $ne: "closed" },
      deadlineAt: { $lt: now },
    })
      .select("_id title deadlineAt")
      .lean(),
    FieldVersion.find({
      fieldPath: "status",
      changedAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    })
      .sort({ changedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const projectMap = new Map(
    projects.map((project) => [project._id.toString(), project.title])
  );

  const deadlineItems = [
    ...milestones.map((milestone) => ({
      id: milestone._id.toString(),
      type: "deadline",
      title: `Milestone: ${milestone.title}`,
      timestamp: milestone.dueDate ?? now,
      project: milestone.projectId
        ? projectMap.get(milestone.projectId.toString()) ?? "Проєкт"
        : "Загальна віха",
    })),
    ...tasks.map((task) => ({
      id: task._id.toString(),
      type: "deadline",
      title: `Задача: ${task.title}`,
      timestamp: task.dueDate ?? now,
      project: projectMap.get(task.projectId.toString()) ?? "Проєкт",
    })),
    ...grantDeadlines.map((grant) => ({
      id: grant._id.toString(),
      type: "deadline",
      title: `Грант: ${grant.title}`,
      timestamp: grant.deadlineAt ?? now,
      project: "Гранти",
      href: `/finance/grants?highlight=${grant._id.toString()}`,
    })),
  ];

  const overdueItems = [
    ...overdueMilestones.map((milestone) => ({
      id: milestone._id.toString(),
      type: "overdue",
      title: `Прострочено: ${milestone.title}`,
      timestamp: milestone.dueDate ?? now,
      project: milestone.projectId
        ? projectMap.get(milestone.projectId.toString()) ?? "Проєкт"
        : "Загальна віха",
    })),
    ...overdueTasks.map((task) => ({
      id: task._id.toString(),
      type: "overdue",
      title: `Прострочено: ${task.title}`,
      timestamp: task.dueDate ?? now,
      project: projectMap.get(task.projectId.toString()) ?? "Проєкт",
    })),
    ...overdueGrants.map((grant) => ({
      id: grant._id.toString(),
      type: "overdue",
      title: `Прострочено: ${grant.title}`,
      timestamp: grant.deadlineAt ?? now,
      project: "Гранти",
      href: `/finance/grants?highlight=${grant._id.toString()}`,
    })),
  ];

  const statusItems = statusChanges.map((change) => ({
    id: change._id.toString(),
    type: "status",
    title: `${change.entityType} змінив статус`,
    timestamp: change.changedAt,
    details: { from: change.oldValue, to: change.newValue },
  }));

  const items = [...overdueItems, ...auditItems, ...deadlineItems, ...statusItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return NextResponse.json({ items });
}
