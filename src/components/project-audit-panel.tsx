"use client";

import { useEffect, useState } from "react";

type AuditItem = {
  _id: string;
  actorId: string;
  action: string;
  entityType: string;
  timestamp: string;
};

export function ProjectAuditPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<AuditItem[]>([]);

  async function loadAudit() {
    const response = await fetch(`/api/projects/${projectId}/audit`);
    if (response.ok) {
      const data = await response.json();
      setItems(data);
    }
  }

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
      <h3 className="text-lg font-semibold">Журнал змін</h3>
      <p className="mt-2 text-sm text-stone-600">
        Останні 50 змін по проєкту.
      </p>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-stone-600">Поки немає записів.</p>
        ) : (
          items.map((item) => (
            <div
              key={item._id}
              className="rounded-xl border border-stone-200/60 bg-stone-50/70 p-3 text-sm text-stone-700"
            >
              <span className="font-semibold text-stone-900">{item.action}</span>{" "}
              {item.entityType}
              <span className="text-xs text-stone-500">
                {" "}· {new Date(item.timestamp).toLocaleString("uk-UA")}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
