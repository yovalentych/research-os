import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { AcademicProfile } from '@/models/academic-profile';
import type { Locale } from '@/lib/i18n';

type AcademicProfileItem = {
  _id: string;
  title?: string;
  status?: 'draft' | 'published' | 'archived';
};

export default async function AcademicProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  // ✅ Next.js 16: params — Promise
  const { locale } = await params;

  const session = await getServerSession(authOptions);

  // ❗ НЕ throw — тільки JSX
  if (!session?.user?.id) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Please sign in to view your Academic Capability Profiles.
      </div>
    );
  }

  await connectToDatabase();

  const profiles = await AcademicProfile.find({
    ownerId: session.user.id,
  })
    .lean<AcademicProfileItem[]>()
    .exec();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Academic Capability Profiles</h1>

        <Link
          href={`/${locale}/academic-profile/create`}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Create ACP
        </Link>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">
          You don’t have any Academic Capability Profiles yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {profiles.map((p) => (
            <li key={p._id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{p.title || 'Untitled ACP'}</div>
                {p.status && (
                  <div className="text-xs text-slate-500">
                    Status: {p.status}
                  </div>
                )}
              </div>

              <Link
                href={`/${locale}/academic-profile/${p._id}`}
                className="text-sm font-medium text-slate-700 hover:underline"
              >
                Open →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
