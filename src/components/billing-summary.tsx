"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getPlanConfig } from "@/lib/billing-config";

type BillingOverview = {
  plan: string;
  planStatus: string;
  planRenewalAt?: string | null;
  usage?: {
    projects: number;
    filesBytes: number;
  };
};

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function BillingSummary({ locale }: { locale: Locale }) {
  const [data, setData] = useState<BillingOverview | null>(null);

  useEffect(() => {
    fetch("/api/billing/overview")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setData(payload);
      })
      .catch(() => undefined);
  }, []);

  const plan = data?.plan ?? "free";
  const planConfig = getPlanConfig(plan);
  const limits = planConfig.limits;
  const usage = data?.usage ?? { projects: 0, filesBytes: 0 };

  const projectPercent = useMemo(() => {
    if (!limits.projects) return 0;
    return Math.min(100, (usage.projects / limits.projects) * 100);
  }, [limits.projects, usage.projects]);

  const storagePercent = useMemo(() => {
    if (!limits.filesBytes) return 0;
    return Math.min(100, (usage.filesBytes / limits.filesBytes) * 100);
  }, [limits.filesBytes, usage.filesBytes]);

  return (
    <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
            Плани
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {planConfig.label}
          </p>
          {data?.planStatus ? (
            <p className="text-[11px] text-slate-500">Статус: {data.planStatus}</p>
          ) : null}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
          <CreditCard className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[11px]">
        <div>
          <div className="flex items-center justify-between">
            <span>Проєкти</span>
            <span>
              {usage.projects}
              {limits.projects ? ` / ${limits.projects}` : " / ∞"}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200">
            <div
              className="h-1.5 rounded-full bg-emerald-500"
              style={{ width: `${projectPercent}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span>Сховище</span>
            <span>
              {formatBytes(usage.filesBytes)}
              {limits.filesBytes ? ` / ${formatBytes(limits.filesBytes)}` : " / ∞"}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200">
            <div
              className="h-1.5 rounded-full bg-indigo-500"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>
      </div>

      <Link
        href={`/${locale}/settings/billing`}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700"
      >
        Управління оплатою
      </Link>
    </div>
  );
}
