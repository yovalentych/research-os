"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function ProfileSummary() {
  const params = useParams();
  const locale = params?.locale ?? "uk";
  const [profile, setProfile] = useState<{
    fullName?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/users/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setProfile(data))
      .catch(() => undefined);
  }, []);

  if (!profile) {
    return null;
  }

  return (
    <Link
      href={`/${locale}/settings/profile`}
      className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
        {(profile.fullName ?? "U").slice(0, 1).toUpperCase()}
      </span>
      <div className="text-left">
        <p className="text-xs font-semibold text-slate-800">
          {profile.fullName || "Профіль"}
        </p>
      </div>
    </Link>
  );
}
