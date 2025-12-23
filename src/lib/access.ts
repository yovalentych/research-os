import type { Session } from "next-auth";
import mongoose from "mongoose";
import { Project } from "@/models/project";
import { Membership } from "@/models/membership";

const elevatedRoles = new Set(["Owner", "Supervisor", "Mentor"]);

export function isElevatedRole(role?: string) {
  return role ? elevatedRoles.has(role) : false;
}

export async function canAccessProject(
  session: Session,
  projectId: mongoose.Types.ObjectId
) {
  if (isElevatedRole(session.user.role)) {
    return true;
  }

  const userId = session.user.id;
  const project = await Project.findById(projectId).lean();
  if (!project) {
    return false;
  }

  if (project.ownerId.toString() === userId) {
    return true;
  }

  const membership = await Membership.findOne({
    projectId,
    userId,
  }).lean();

  return Boolean(membership);
}

export async function getProjectAccess(
  session: Session,
  projectId: mongoose.Types.ObjectId
) {
  if (isElevatedRole(session.user.role)) {
    return { canView: true, canEdit: true, role: session.user.role };
  }

  const userId = session.user.id;
  const project = await Project.findById(projectId).lean();
  if (!project) {
    return { canView: false, canEdit: false, role: null };
  }

  if (project.ownerId.toString() === userId) {
    return { canView: true, canEdit: true, role: "Owner" };
  }

  const membership = await Membership.findOne({ projectId, userId }).lean();
  if (!membership) {
    return { canView: false, canEdit: false, role: null };
  }

  return {
    canView: true,
    canEdit: membership.role === "Collaborator",
    role: membership.role,
  };
}

export async function canEditProject(
  session: Session,
  projectId: mongoose.Types.ObjectId
) {
  const access = await getProjectAccess(session, projectId);
  return access.canEdit;
}
