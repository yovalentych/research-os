import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { AcademicProfile } from '@/models/academic-profile';
import mongoose from 'mongoose';

/**
 * GET /api/academic-profile/[id]/export
 * Експорт ACP (JSON)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
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
    .lean()
    .exec();

  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    profile,
  });
}
