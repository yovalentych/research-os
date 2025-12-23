"use client";

import { useEffect, useMemo, useState } from "react";
import { BILLING_PLANS, getPlanConfig } from "@/lib/billing-config";

type BillingOverview = {
  plan: string;
  planStatus: string;
  planRenewalAt?: string | null;
  usage?: {
    projects: number;
    filesBytes: number;
  };
  paymentMethod?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  } | null;
  invoices?: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    hostedInvoiceUrl?: string | null;
    created: number;
  }[];
};

const planLabelMap: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  lab: "Lab",
};

export function PlansPanel() {
  const [currentPlan, setCurrentPlan] = useState("free");
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  useEffect(() => {
    fetch("/api/users/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.plan) {
          setCurrentPlan(data.plan);
        }
        if (data?.planStatus) {
          setPlanStatus(data.planStatus);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/billing/overview")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setOverview(data);
          if (data.plan) {
            setCurrentPlan(data.plan);
          }
          if (data.planStatus) {
            setPlanStatus(data.planStatus);
          }
        }
      })
      .catch(() => undefined);
  }, []);

  const renewalDate = overview?.planRenewalAt
    ? new Date(overview.planRenewalAt)
    : null;

  const usage = overview?.usage ?? { projects: 0, filesBytes: 0 };
  const planLimits = useMemo(
    () => getPlanConfig(currentPlan).limits,
    [currentPlan]
  );

  const projectUsagePercent =
    planLimits.projects && planLimits.projects > 0
      ? Math.min(100, (usage.projects / planLimits.projects) * 100)
      : 0;
  const storageUsagePercent =
    planLimits.filesBytes && planLimits.filesBytes > 0
      ? Math.min(100, (usage.filesBytes / planLimits.filesBytes) * 100)
      : 0;

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

  function handleExportCsv() {
    if (!overview?.invoices?.length) {
      setMessage("Немає інвойсів для експорту.");
      return;
    }
    const header = [
      "Date",
      "Status",
      "Amount",
      "Currency",
      "InvoiceUrl",
      "InvoiceId",
    ];
    const rows = overview.invoices.map((invoice) => [
      new Date(invoice.created * 1000).toISOString(),
      invoice.status,
      (invoice.amount / 100).toFixed(2),
      invoice.currency.toUpperCase(),
      invoice.hostedInvoiceUrl ?? "",
      invoice.id,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "billing-history.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleManagePortal() {
    setMessage(null);
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returnUrl: window.location.origin + window.location.pathname,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відкрити Stripe Portal.");
      return;
    }
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
    }
  }

  async function handleSelect(planId: string) {
    setMessage(null);
    setLoadingPlan(planId);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          returnUrl: window.location.origin + window.location.pathname,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Не вдалося створити оплату.");
        return;
      }
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.status === "free") {
        setCurrentPlan("free");
        setPlanStatus("active");
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Монетизація</p>
        <h1 className="text-2xl font-semibold text-slate-900">Плани та оплата</h1>
        <p className="text-sm text-slate-600">
          Обери план для себе або лабораторії. Після оплати доступи оновляться
          автоматично.
        </p>
      </div>
      {planStatus ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Поточний статус підписки:{" "}
          <span className="font-semibold text-slate-900">{planStatus}</span>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-3xl border p-6 shadow-sm transition ${
              currentPlan === plan.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{plan.label}</h3>
              {currentPlan === plan.id ? (
                <span className="rounded-full border border-white/30 px-3 py-1 text-xs">
                  Поточний
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-semibold">{plan.priceLabel}</p>
            <p className={`mt-2 text-sm ${currentPlan === plan.id ? "text-white/70" : "text-slate-600"}`}>
              {plan.description}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={currentPlan === plan.id || loadingPlan === plan.id}
              className={`mt-6 w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
                currentPlan === plan.id
                  ? "bg-white/10 text-white/70"
                  : "border border-slate-200 text-slate-700"
              }`}
              onClick={() => handleSelect(plan.id)}
            >
              {currentPlan === plan.id
                ? "Активний"
                : loadingPlan === plan.id
                  ? "Переходимо до оплати..."
                  : "Обрати"}
            </button>
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "overview", label: "Огляд" },
            { id: "history", label: "Історія платежів" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "overview" | "history")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "overview" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Стан підписки</h2>
              <p className="mt-1 text-sm text-slate-600">
                План:{" "}
                <span className="font-semibold text-slate-900">
                  {planLabelMap[currentPlan] ?? currentPlan}
                </span>
              </p>
              {planStatus ? (
                <p className="text-sm text-slate-600">Статус: {planStatus}</p>
              ) : null}
              {renewalDate ? (
                <p className="text-sm text-slate-600">
                  Наступне списання:{" "}
                  {renewalDate.toLocaleDateString("uk-UA", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleManagePortal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Керувати підпискою
                </button>
              </div>
              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div>
                  <div className="flex items-center justify-between">
                    <span>Проєкти</span>
                    <span>
                      {usage.projects}
                      {planLimits.projects ? ` / ${planLimits.projects}` : " / ∞"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${projectUsagePercent}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span>Сховище</span>
                    <span>
                      {formatBytes(usage.filesBytes)}
                      {planLimits.filesBytes
                        ? ` / ${formatBytes(planLimits.filesBytes)}`
                        : " / ∞"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${storageUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Платіжні дані</h2>
              {overview?.paymentMethod ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {overview.paymentMethod.brand?.toUpperCase() ?? "Картка"} ·••
                    {overview.paymentMethod.last4}
                  </p>
                  <p className="text-xs text-slate-500">
                    Дійсна до {overview.paymentMethod.expMonth}/
                    {overview.paymentMethod.expYear}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Дані про карту з&apos;являться після першої оплати.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Останні транзакції та інвойси з Stripe.
              </p>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Експорт CSV
              </button>
            </div>
            {overview?.invoices?.length ? (
              <div className="space-y-2 text-sm text-slate-600">
                {overview.invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {new Date(invoice.created * 1000).toLocaleDateString("uk-UA")}
                      </p>
                      <p className="text-xs text-slate-500">{invoice.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {(invoice.amount / 100).toFixed(2)}{" "}
                        {invoice.currency.toUpperCase()}
                      </p>
                      {invoice.hostedInvoiceUrl ? (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-600 underline"
                        >
                          Переглянути
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Інвойсів поки немає.</p>
            )}
          </div>
        )}
      </div>
      {message ? <p className="text-sm text-rose-600">{message}</p> : null}
    </div>
  );
}
