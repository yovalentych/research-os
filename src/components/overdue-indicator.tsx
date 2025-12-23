"use client";

import { useEffect, useState } from "react";

type NotificationEntry = {
  type: "audit" | "deadline" | "status" | "overdue";
};

export function OverdueIndicator() {
  const [count, setCount] = useState(0);

  async function loadCount() {
    const response = await fetch("/api/notifications?limit=50");
    if (!response.ok) return;
    const data = await response.json();
    const items: NotificationEntry[] = data.items ?? [];
    const overdue = items.filter((entry) => entry.type === "overdue").length;
    setCount(overdue);
  }

  useEffect(() => {
    loadCount();
    const timer = window.setInterval(loadCount, 60000);
    return () => window.clearInterval(timer);
  }, []);

  if (count === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
      Прострочені дедлайни
      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">
        {count}
      </span>
    </div>
  );
}
