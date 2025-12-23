'use client';

import { useEffect, useState } from 'react';

export default function ACPEditor({ params }: any) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/academic-profile/${params.id}`)
      .then((r) => r.json())
      .then(setProfile);
  }, [params.id]);

  async function save() {
    await fetch(`/api/academic-profile/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    alert('Saved');
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <input
        className="w-full text-2xl font-semibold"
        value={profile.title}
        onChange={(e) => setProfile({ ...profile, title: e.target.value })}
      />

      <textarea
        placeholder="Research interests"
        className="w-full border p-2"
        value={profile.identity?.researchInterests?.join(', ') || ''}
        onChange={(e) =>
          setProfile({
            ...profile,
            identity: {
              ...profile.identity,
              researchInterests: e.target.value.split(','),
            },
          })
        }
      />

      <button onClick={save} className="rounded bg-black px-4 py-2 text-white">
        Save
      </button>
    </div>
  );
}
