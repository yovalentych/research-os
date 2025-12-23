import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ContactRequest } from "@/models/contact-request";
import { User } from "@/models/user";
import { logCreate, logUpdate } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const userId = new mongoose.Types.ObjectId(session.user.id);

  const requests = await ContactRequest.find({
    $or: [{ requesterId: userId }, { recipientId: userId }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const userIds = Array.from(
    new Set(
      requests.flatMap((item) => [
        item.requesterId.toString(),
        item.recipientId.toString(),
      ])
    )
  );

  const users = await User.find({ _id: { $in: userIds } })
    .select("_id fullName email organizationName degreeCompleted")
    .lean();
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  const incoming = requests
    .filter(
      (req) => req.recipientId.toString() === session.user.id && req.status === "pending"
    )
    .map((req) => ({
      id: req._id.toString(),
      status: req.status,
      createdAt: req.createdAt,
      user: userMap.get(req.requesterId.toString()) ?? null,
    }));

  const outgoing = requests
    .filter(
      (req) => req.requesterId.toString() === session.user.id && req.status === "pending"
    )
    .map((req) => ({
      id: req._id.toString(),
      status: req.status,
      createdAt: req.createdAt,
      user: userMap.get(req.recipientId.toString()) ?? null,
    }));

  const contacts = requests
    .filter((req) => req.status === "accepted")
    .map((req) => {
      const isRequester = req.requesterId.toString() === session.user.id;
      const otherId = isRequester ? req.recipientId.toString() : req.requesterId.toString();
      return {
        id: req._id.toString(),
        since: req.updatedAt ?? req.createdAt,
        user: userMap.get(otherId) ?? null,
      };
    });

  return NextResponse.json({ incoming, outgoing, contacts });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId } = body ?? {};
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
  }

  await connectToDatabase();
  const requesterId = new mongoose.Types.ObjectId(session.user.id);
  const recipientId = new mongoose.Types.ObjectId(userId);
  const recipient = await User.findById(recipientId).lean();
  if (!recipient || recipient.publicProfile === false) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await ContactRequest.findOne({
    $or: [
      { requesterId, recipientId },
      { requesterId: recipientId, recipientId: requesterId },
    ],
  }).lean();

  if (existing?.status === "pending") {
    return NextResponse.json({ error: "Request already pending" }, { status: 409 });
  }
  if (existing?.status === "accepted") {
    return NextResponse.json({ error: "Already in contacts" }, { status: 409 });
  }

  if (existing?.status === "declined") {
    const updated = await ContactRequest.findByIdAndUpdate(
      existing._id,
      { requesterId, recipientId, status: "pending" },
      { new: true }
    ).lean();
    await logUpdate({
      actorId: session.user.id,
      entityType: "ContactRequest",
      entityId: new mongoose.Types.ObjectId(existing._id),
      previous: existing as Record<string, unknown>,
      next: { requesterId, recipientId, status: "pending" },
    });
    return NextResponse.json(updated);
  }

  const created = await ContactRequest.create({
    requesterId,
    recipientId,
    status: "pending",
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "ContactRequest",
    entityId: created._id,
  });

  return NextResponse.json(created);
}
