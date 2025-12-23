import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isElevatedRole } from "@/lib/access";
import { getEdboSyncInfo, syncEdboInstitutions } from "@/lib/edbo";
import { SourceCache } from "@/models/source-cache";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const info = await getEdboSyncInfo();
  return NextResponse.json(info);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const intervalDays =
    typeof body?.intervalDays === "number" ? body.intervalDays : null;
  if (!intervalDays || ![1, 7].includes(intervalDays)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  await SourceCache.updateOne(
    { key: "edbo-universities" },
    {
      $set: { intervalDays },
      $setOnInsert: { syncedAt: new Date(0) },
    },
    { upsert: true }
  );

  const info = await getEdboSyncInfo();
  return NextResponse.json(info);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const syncedAt = await syncEdboInstitutions(true);
  const info = await getEdboSyncInfo();
  return NextResponse.json({ ...info, syncedAt });
}
