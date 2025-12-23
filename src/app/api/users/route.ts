import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User, GLOBAL_ROLES } from "@/models/user";
import { isElevatedRole } from "@/lib/access";
import { logCreate } from "@/lib/audit";

function isOwner(role?: string) {
  return role === "Owner";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const users = await User.find().select("-passwordHash").lean();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOwner(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, fullName, globalRole } = body ?? {};

  if (!email || !password || !fullName) {
    return NextResponse.json(
      { error: "Email, password, fullName are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "User already exists" },
      { status: 409 }
    );
  }

  const safeRole = GLOBAL_ROLES.includes(globalRole)
    ? globalRole
    : "Collaborator";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    passwordHash,
    fullName,
    globalRole: safeRole,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "User",
    entityId: user._id,
  });

  const response = user.toObject();
  delete response.passwordHash;

  return NextResponse.json(response);
}
