import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { isElevatedRole } from "@/lib/access";
import { Grant } from "@/models/grant";
import { logCreate } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const archiveFilter = buildArchiveFilter(searchParams);
  const status = searchParams.get("status");

  await connectToDatabase();
  const query: Record<string, unknown> = { ...archiveFilter };
  if (status) {
    query.status = status;
  }

  const grants = await Grant.find(query).sort({ deadlineAt: 1 }).lean();
  return NextResponse.json(grants);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title } = body ?? {};
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  await connectToDatabase();
  const grant = await Grant.create({
    title,
    status: body?.status ?? "planned",
    organization: body?.organization ?? "",
    country: body?.country ?? "",
    description: body?.description ?? "",
    deadlineAt: body?.deadlineAt ? new Date(body.deadlineAt) : null,
    plannedSubmissionAt: body?.plannedSubmissionAt
      ? new Date(body.plannedSubmissionAt)
      : null,
    amount: Number(body?.amount ?? 0),
    currency: body?.currency ?? "UAH",
    documents: body?.documents ?? "",
    notes: body?.notes ?? "",
    createdBy: session.user.id,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "Grant",
    entityId: grant._id,
  });

  return NextResponse.json(grant);
}
