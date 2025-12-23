import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { isElevatedRole } from "@/lib/access";
import { ScholarshipPayment } from "@/models/scholarship-payment";
import { logCreate } from "@/lib/audit";

function normalizePeriod(period?: string | null, paidAt?: Date | null) {
  if (period) return period;
  if (paidAt) {
    const year = paidAt.getUTCFullYear();
    const month = String(paidAt.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return undefined;
}

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
  const year = searchParams.get("year");

  await connectToDatabase();
  const query: Record<string, unknown> = { ...archiveFilter };
  if (year) {
    query.period = { $regex: `^${year}` };
  }

  const items = await ScholarshipPayment.find(query)
    .sort({ paidAt: -1, period: -1 })
    .lean();

  return NextResponse.json(items);
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
  const paidAt = body?.paidAt ? new Date(body.paidAt) : null;
  const period = normalizePeriod(body?.period, paidAt);

  if (!paidAt || !period) {
    return NextResponse.json(
      { error: "paidAt and period are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const grossAmount = Number(body?.grossAmount ?? 0);
  const netAmount = Number(body?.netAmount ?? 0);
  const taxAmount =
    body?.taxAmount !== undefined && body?.taxAmount !== null
      ? Number(body?.taxAmount ?? 0)
      : Math.max(0, grossAmount - netAmount);

  const payment = await ScholarshipPayment.create({
    period,
    paidAt,
    grossAmount,
    netAmount,
    taxAmount,
    currency: body?.currency ?? "UAH",
    notes: body?.notes ?? "",
    createdBy: session.user.id,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "ScholarshipPayment",
    entityId: payment._id,
  });

  return NextResponse.json(payment);
}
