'use client';

import { useRouter } from 'next/navigation';

export default function CreateACP() {
  const router = useRouter();

  async function create() {
    const res = await fetch('/api/academic-profile', {
      method: 'POST',
      body: JSON.stringify({ title: 'Academic Capability Profile' }),
    });
    const data = await res.json();
    router.push(`/academic-profile/${data._id}`);
  }

  return (
    <button onClick={create} className="rounded bg-black px-4 py-2 text-white">
      Create profile
    </button>
  );
}
