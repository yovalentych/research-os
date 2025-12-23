import mongoose from "mongoose";
import type { Session } from "next-auth";
import {
  canAccessProject,
  canEditProject,
  isElevatedRole,
} from "./access";

type ManuscriptLike = {
  projectId?: mongoose.Types.ObjectId | string | null;
  createdBy?: mongoose.Types.ObjectId | string | null;
};

export async function hasManuscriptAccess(
  session: Session,
  manuscript: ManuscriptLike,
  options?: { requireEdit?: boolean }
) {
  if (manuscript.projectId) {
    const projectId = new mongoose.Types.ObjectId(manuscript.projectId);
    if (options?.requireEdit) {
      return canEditProject(session, projectId);
    }
    return canAccessProject(session, projectId);
  }

  if (isElevatedRole(session.user.role)) {
    return true;
  }

  const actorId = manuscript.createdBy?.toString();
  return Boolean(actorId && actorId === session.user.id);
}

export function getManuscriptProjectId(
  manuscript: ManuscriptLike
): mongoose.Types.ObjectId | null {
  if (!manuscript.projectId) {
    return null;
  }
  return new mongoose.Types.ObjectId(manuscript.projectId);
}
