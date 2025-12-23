import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import {
  AcademicProfile,
  type AcademicProfileDocument,
} from '@/models/academic-profile';

/**
 * GET /api/academic-profile
 * Список Academic Capability Profiles користувача
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const profiles = await AcademicProfile.find({
    ownerId: session.user.id,
  })
    // 🔑 ЧІТКО: масив документів
    .lean<AcademicProfileDocument[]>()
    .exec();

  return NextResponse.json(profiles);
}

/**
 * POST /api/academic-profile
 * Створити новий Academic Capability Profile
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json();

  await connectToDatabase();

  const profile: AcademicProfileDocument = await AcademicProfile.create({
    ...data,
    ownerId: session.user.id,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({
    _id: profile._id,
  });
}
