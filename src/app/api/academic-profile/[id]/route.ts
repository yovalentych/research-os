import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import {
  AcademicProfile,
  type AcademicProfileDocument,
} from '@/models/academic-profile';
import mongoose from 'mongoose';

/**
 * GET /api/academic-profile/[id]
 * Отримати один Academic Capability Profile
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const profile = await AcademicProfile.findOne({
    _id: id,
    ownerId: session.user.id,
  })
    // 🔑 ВАЖЛИВО: ЯВНА ТИПІЗАЦІЯ
    .lean<AcademicProfileDocument | null>()
    .exec();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

/**
 * PUT /api/academic-profile/[id]
 * Autosave / оновлення ACP
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();

  await connectToDatabase();

  const profile = await AcademicProfile.findOneAndUpdate(
    { _id: id, ownerId: session.user.id },
    {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    },
    { new: true }
  )
    // 🔑 ВАЖЛИВО: НЕ масив, А ОБʼЄКТ
    .lean<AcademicProfileDocument | null>()
    .exec();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

/**
 * DELETE /api/academic-profile/[id]
 * Видалення ACP
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const result = await AcademicProfile.deleteOne({
    _id: id,
    ownerId: session.user.id,
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
