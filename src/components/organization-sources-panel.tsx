"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type SyncInfo = {
  syncedAt?: string | null;
  count?: number;
  intervalDays?: number;
  syncInProgress?: boolean;
  syncStartedAt?: string | null;
  syncTotal?: number | null;
  syncProcessed?: number | null;
  syncMessage?: string | null;
};

export function OrganizationSourcesPanel() {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [intervalDays, setIntervalDays] = useState<1 | 7>(7);

  useEffect(() => {
    fetch("/api/organizations/refresh")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setInfo(data);
        if (data?.intervalDays === 1 || data?.intervalDays === 7) {
          setIntervalDays(data.intervalDays);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!info?.syncInProgress) return;
    const timer = window.setInterval(() => {
      fetch("/api/organizations/refresh")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) {
            setInfo(data);
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [info?.syncInProgress]);

  async function handleRefresh() {
    setLoading(true);
    setMessage(null);
    setInfo((prev) =>
      prev
        ? {
            ...prev,
            syncInProgress: true,
            syncProcessed: 0,
            syncTotal: prev.syncTotal ?? 2,
            syncMessage: "Починаємо синхронізацію",
          }
        : {
            syncInProgress: true,
            syncProcessed: 0,
            syncTotal: 2,
            syncMessage: "Починаємо синхронізацію",
          }
    );
    try {
      const response = await fetch("/api/organizations/refresh", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Не вдалося оновити кеш ЄДЕБО.");
        return;
      }
      const data = await response.json();
      setInfo(data);
      setMessage("Кеш ЄДЕБО оновлено.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveInterval() {
    setSavingInterval(true);
    setMessage(null);
    try {
      const response = await fetch("/api/organizations/refresh", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalDays }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Не вдалося зберегти інтервал.");
        return;
      }
      const data = await response.json();
      setInfo(data);
      setMessage("Інтервал оновлення збережено.");
    } finally {
      setSavingInterval(false);
    }
  }

  const syncedLabel = info?.syncedAt
    ? new Date(info.syncedAt).toLocaleString("uk-UA")
    : "Немає даних";
  const progressPercent =
    info?.syncTotal && info.syncProcessed !== null
      ? Math.min(100, (info.syncProcessed / info.syncTotal) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Довідники
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">ЄДЕБО каталог</h1>
        <p className="text-sm text-slate-600">
          Оновлюй офіційний список організацій для швидкого пошуку у реєстрації та
          афіліаціях.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">
              Останнє оновлення:{" "}
              <span className="font-semibold text-slate-900">{syncedLabel}</span>
            </p>
            <p className="text-sm text-slate-500">
              Записів у кеші: {info?.count ?? 0}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Оновлюємо..." : "Оновити кеш ЄДЕБО"}
          </button>
        </div>
        {info?.syncInProgress ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Синхронізація в процесі
            </p>
            <p className="text-xs text-slate-500">
              {info.syncMessage ?? "Оновлюємо дані"} · {info.syncProcessed ?? 0}/
              {info.syncTotal ?? 0}
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Інтервал оновлення
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Обери як часто оновлювати дані ЄДЕБО.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 1, label: "Щодня" },
            { id: 7, label: "Щотижня" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIntervalDays(item.id as 1 | 7)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                intervalDays === item.id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSaveInterval}
            disabled={savingInterval}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-70"
          >
            {savingInterval ? "Зберігаємо..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}
