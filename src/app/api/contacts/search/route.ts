import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json([]);
  }

  await connectToDatabase();
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const users = await User.find({
    _id: { $ne: session.user.id },
    publicProfile: { $ne: false },
    $or: [
      { fullName: regex },
      { latinFullName: regex },
      { firstName: regex },
      { lastName: regex },
      { latinFirstName: regex },
      { latinLastName: regex },
      { email: regex },
      { organizationName: regex },
    ],
  })
    .select("_id fullName email organizationName degreeCompleted")
    .limit(20)
    .lean();

  const results = users.map((user) => ({
    id: user._id.toString(),
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    organizationName: user.organizationName ?? "",
    degreeCompleted: user.degreeCompleted ?? "",
  }));

  return NextResponse.json(results);
}
