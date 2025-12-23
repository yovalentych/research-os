"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: window.location.origin + window.location.pathname,
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-70"
    >
      <CreditCard className="h-4 w-4" />
      {loading ? "Відкриваємо..." : "Billing"}
    </button>
  );
}
