import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User, GLOBAL_ROLES } from "@/models/user";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "Owner") {
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

  return NextResponse.json({
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    globalRole: user.globalRole,
  });
}
