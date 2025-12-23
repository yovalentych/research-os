"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Pencil } from "lucide-react";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

const currencies = ["UAH", "USD", "EUR"];

type ScholarshipPayment = {
  _id: string;
  period?: string;
  paidAt?: string;
  grossAmount?: number;
  netAmount?: number;
  taxAmount?: number;
  currency?: string;
  notes?: string;
};

type Grant = {
  _id: string;
  title: string;
  status?: string;
  organization?: string;
  country?: string;
  description?: string;
  deadlineAt?: string | null;
  plannedSubmissionAt?: string | null;
  amount?: number;
  currency?: string;
  documents?: string;
  notes?: string;
};

const grantStatuses = [
  { value: "active", label: "Активні" },
  { value: "preparing", label: "У підготовці" },
  { value: "planned", label: "Заплановані" },
  { value: "closed", label: "Завершені" },
];

function formatAmount(value?: number, currency = "UAH") {
  if (!value) return "—";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("uk-UA");
}

function monthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function FinancePanel({ view = "all" }: { view?: "all" | "scholarships" | "grants" }) {
  const [payments, setPayments] = useState<ScholarshipPayment[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentYear, setPaymentYear] = useState("all");
  const [grantStatusFilter, setGrantStatusFilter] = useState("all");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [paymentForm, setPaymentForm] = useState({
    period: monthValue(),
    paidAt: new Date().toISOString().slice(0, 10),
    grossAmount: "",
    netAmount: "",
    taxAmount: "",
    currency: "UAH",
    notes: "",
  });
  const [grantForm, setGrantForm] = useState({
    title: "",
    status: "planned",
    organization: "",
    country: "",
    description: "",
    deadlineAt: "",
    plannedSubmissionAt: "",
    amount: "",
    currency: "UAH",
    documents: "",
    notes: "",
  });
  const [showCreatePayment, setShowCreatePayment] = usePersistentToggle(
    "form:finance:payment",
    false
  );
  const [showCreateGrant, setShowCreateGrant] = usePersistentToggle(
    "form:finance:grant",
    false
  );
  const paymentFormRef = useRef<HTMLFormElement | null>(null);
  const grantFormRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreatePayment, paymentFormRef);
  useAutoFocus(showCreateGrant, grantFormRef);
  const [editingPayment, setEditingPayment] = useState<ScholarshipPayment | null>(
    null
  );
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const searchParams = useSearchParams();
  const highlightGrantId = searchParams.get("highlight");

  async function loadPayments(year = paymentYear) {
    const params = year !== "all" ? `?year=${year}` : "";
    const response = await fetch(`/api/finance/scholarships${params}`);
    if (response.ok) {
      setPayments(await response.json());
    }
  }

  async function loadGrants() {
    const response = await fetch("/api/finance/grants");
    if (response.ok) {
      setGrants(await response.json());
    }
  }

  useEffect(() => {
    loadPayments();
    loadGrants();
  }, []);

  useEffect(() => {
    loadPayments(paymentYear);
  }, [paymentYear]);

  const yearOptions = useMemo(() => {
    const years = new Set(
      payments
        .map((item) => item.period?.slice(0, 4))
        .filter((value): value is string => Boolean(value))
    );
    return Array.from(years).sort().reverse();
  }, [payments]);

  function exportCsv(filename: string, rows: string[][]) {
    const csv = rows
      .map((row) => row.map((value) => `\"${value.replace(/\"/g, '\"\"')}\"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPayments() {
    const rows = [
      ["Period", "PaidAt", "Gross", "Net", "Tax", "Currency", "Notes"],
      ...payments.map((item) => [
        item.period ?? "",
        item.paidAt ?? "",
        String(item.grossAmount ?? 0),
        String(item.netAmount ?? 0),
        String(item.taxAmount ?? 0),
        item.currency ?? "UAH",
        item.notes ?? "",
      ]),
    ];
    exportCsv(`scholarships-${paymentYear === "all" ? "all" : paymentYear}.csv`, rows);
  }

  function handleExportGrants() {
    const visible = grantStatusFilter === "all"
      ? grants
      : grants.filter((grant) => (grant.status ?? "planned") === grantStatusFilter);
    const rows = [
      ["Title", "Status", "Organization", "Country", "Deadline", "PlannedSubmission", "Amount", "Currency", "Documents", "Notes"],
      ...visible.map((grant) => [
        grant.title ?? "",
        grant.status ?? "",
        grant.organization ?? "",
        grant.country ?? "",
        grant.deadlineAt ?? "",
        grant.plannedSubmissionAt ?? "",
        String(grant.amount ?? 0),
        grant.currency ?? "UAH",
        grant.documents ?? "",
        grant.notes ?? "",
      ]),
    ];
    exportCsv(`grants-${grantStatusFilter}.csv`, rows);
  }
  const totals = useMemo(() => {
    return payments.reduce(
      (acc, item) => {
        acc.gross += item.grossAmount ?? 0;
        acc.net += item.netAmount ?? 0;
        acc.tax += item.taxAmount ?? 0;
        return acc;
      },
      { gross: 0, net: 0, tax: 0 }
    );
  }, [payments]);

  const overviewStats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const ytd = payments.filter((item) => item.period?.startsWith(String(year)));
    const ytdTotals = ytd.reduce(
      (acc, item) => {
        acc.gross += item.grossAmount ?? 0;
        acc.net += item.netAmount ?? 0;
        acc.tax += item.taxAmount ?? 0;
        return acc;
      },
      { gross: 0, net: 0, tax: 0 }
    );

    const lastMonths: { label: string; net: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = date.toLocaleDateString("uk-UA", { month: "short" });
      const period = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const net = payments
        .filter((item) => item.period === period)
        .reduce((sum, item) => sum + (item.netAmount ?? 0), 0);
      lastMonths.push({ label, net });
    }
    const maxNet = Math.max(1, ...lastMonths.map((entry) => entry.net));

    const statusCounts = grantStatuses.reduce<Record<string, number>>(
      (acc, status) => {
        acc[status.value] = grants.filter(
          (grant) => (grant.status ?? "planned") === status.value
        ).length;
        return acc;
      },
      {}
    );
    const totalGrants = Object.values(statusCounts).reduce(
      (sum, value) => sum + value,
      0
    );

    const upcomingDeadlines = grants
      .filter((grant) => grant.deadlineAt)
      .sort(
        (a, b) =>
          new Date(a.deadlineAt ?? "").getTime() -
          new Date(b.deadlineAt ?? "").getTime()
      )
      .slice(0, 3);

    const lastPayment = payments
      .filter((item) => item.paidAt)
      .sort(
        (a, b) =>
          new Date(b.paidAt ?? "").getTime() -
          new Date(a.paidAt ?? "").getTime()
      )[0];
    const nextExpectedMonth = monthValue(
      lastPayment?.paidAt ? new Date(lastPayment.paidAt) : new Date()
    );

    return {
      ytdTotals,
      lastMonths,
      maxNet,
      statusCounts,
      totalGrants,
      upcomingDeadlines,
      nextExpectedMonth,
    };
  }, [payments, grants]);

  const cumulative = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthlyNet = Array.from({ length: 12 }, (_, index) => {
      const period = `${year}-${String(index + 1).padStart(2, "0")}`;
      return payments
        .filter((item) => item.period === period)
        .reduce((sum, item) => sum + (item.netAmount ?? 0), 0);
    });
    const cumulativeNet = monthlyNet.reduce<number[]>((acc, value, index) => {
      const prev = index === 0 ? 0 : acc[index - 1];
      acc.push(prev + value);
      return acc;
    }, []);
    const max = Math.max(1, ...cumulativeNet);
    return { monthlyNet, cumulativeNet, max };
  }, [payments]);

  const calendar = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const start = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = (start.getDay() + 6) % 7;

    const eventMap = new Map<
      number,
      { payments: number; netSum: number; grants: { id: string; title: string }[] }
    >();
    payments.forEach((item) => {
      if (!item.paidAt) return;
      const date = new Date(item.paidAt);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const day = date.getDate();
      const existing = eventMap.get(day) ?? { payments: 0, netSum: 0, grants: [] };
      existing.payments += 1;
      existing.netSum += item.netAmount ?? 0;
      eventMap.set(day, existing);
    });
    grants.forEach((grant) => {
      if (!grant.deadlineAt) return;
      const date = new Date(grant.deadlineAt);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const day = date.getDate();
      const existing = eventMap.get(day) ?? { payments: 0, netSum: 0, grants: [] };
      existing.grants.push({ id: grant._id, title: grant.title });
      eventMap.set(day, existing);
    });

    const cells = Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - startDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return { key: `empty-${index}`, day: null };
      }
      return {
        key: `day-${dayNumber}`,
        day: dayNumber,
        events: eventMap.get(dayNumber) ?? { payments: 0, grants: [] },
      };
    });

    return { year, month, cells };
  }, [payments, grants, calendarDate]);

  useEffect(() => {
    if (!highlightGrantId) return;
    const target = document.getElementById(`grant-${highlightGrantId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightGrantId, grants]);

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const gross = Number(paymentForm.grossAmount || 0);
    const net = Number(paymentForm.netAmount || 0);
    const tax =
      paymentForm.taxAmount !== ""
        ? Number(paymentForm.taxAmount || 0)
        : Math.max(0, gross - net);

    const response = await fetch("/api/finance/scholarships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period: paymentForm.period,
        paidAt: paymentForm.paidAt,
        grossAmount: gross,
        netAmount: net,
        taxAmount: tax,
        currency: paymentForm.currency,
        notes: paymentForm.notes,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося додати виплату");
      return;
    }

    setPaymentForm((prev) => ({
      ...prev,
      grossAmount: "",
      netAmount: "",
      taxAmount: "",
      notes: "",
    }));
    loadPayments();
  }

  async function handleUpdatePayment() {
    if (!editingPayment) return;
    setMessage(null);

    const gross = Number(editingPayment.grossAmount ?? 0);
    const net = Number(editingPayment.netAmount ?? 0);
    const tax = Number(editingPayment.taxAmount ?? 0);
    const taxAmount =
      editingPayment.taxAmount === undefined || editingPayment.taxAmount === null
        ? Math.max(0, gross - net)
        : tax;

    const response = await fetch(
      `/api/finance/scholarships/${editingPayment._id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: editingPayment.period,
          paidAt: editingPayment.paidAt,
          grossAmount: gross,
          netAmount: net,
          taxAmount,
          currency: editingPayment.currency ?? "UAH",
          notes: editingPayment.notes ?? "",
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити виплату");
      return;
    }

    setEditingPayment(null);
    loadPayments();
  }

  async function handleArchivePayment(id: string) {
    setMessage(null);
    const response = await fetch(`/api/finance/scholarships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати виплату");
      return;
    }

    loadPayments();
  }

  async function handleCreateGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/finance/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...grantForm,
        amount: Number(grantForm.amount || 0),
        deadlineAt: grantForm.deadlineAt || null,
        plannedSubmissionAt: grantForm.plannedSubmissionAt || null,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося додати грант");
      return;
    }

    setGrantForm((prev) => ({
      ...prev,
      title: "",
      description: "",
      documents: "",
      notes: "",
    }));
    loadGrants();
  }

  async function handleUpdateGrant() {
    if (!editingGrant) return;
    setMessage(null);
    const response = await fetch(`/api/finance/grants/${editingGrant._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editingGrant,
        amount: Number(editingGrant.amount || 0),
        deadlineAt: editingGrant.deadlineAt || null,
        plannedSubmissionAt: editingGrant.plannedSubmissionAt || null,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити грант");
      return;
    }

    setEditingGrant(null);
    loadGrants();
  }

  async function handleArchiveGrant(id: string) {
    setMessage(null);
    const response = await fetch(`/api/finance/grants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати грант");
      return;
    }

    loadGrants();
  }

  const groupedGrants = useMemo(() => {
    return grantStatuses.reduce<Record<string, Grant[]>>((acc, status) => {
      acc[status.value] = grants.filter(
        (grant) => (grant.status ?? "planned") === status.value
      );
      return acc;
    }, {});
  }, [grants]);

  return (
    <div className="space-y-6">
      {view === "all" ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Фінансовий огляд
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Поточна статистика та динаміка надходжень.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  YTD Gross
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatAmount(overviewStats.ytdTotals.gross)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  YTD Net
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatAmount(overviewStats.ytdTotals.net)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Податки YTD
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatAmount(overviewStats.ytdTotals.tax)}
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Net надходження (6 міс.)</span>
                <span>Останній місяць</span>
              </div>
              <div className="mt-4 flex items-end gap-3">
                {overviewStats.lastMonths.map((month) => (
                  <div key={month.label} className="flex flex-col items-center gap-2">
                    <div className="h-24 w-6 rounded-full bg-slate-100">
                      <div
                        className="w-full rounded-full bg-slate-700"
                        style={{
                          height: `${Math.round(
                            (month.net / overviewStats.maxNet) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Cumulative net (рік)</span>
                <span>{new Date().getFullYear()}</span>
              </div>
              <div className="mt-4 h-28">
                <svg viewBox="0 0 300 100" className="h-full w-full">
                  <polyline
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="3"
                    points={cumulative.cumulativeNet
                      .map((value, index) => {
                        const x = (index / 11) * 300;
                        const y =
                          100 - (value / cumulative.max) * 90 - 5;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </svg>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                {Array.from({ length: 12 }, (_, index) => (
                  <span key={`m-${index}`}>{index + 1}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Гранти</h3>
            <p className="mt-1 text-xs text-slate-500">
              Розподіл за статусами та найближчі дедлайни.
            </p>
            <div className="mt-4 space-y-3">
              {grantStatuses.map((status) => {
                const count = overviewStats.statusCounts[status.value] ?? 0;
                const total = Math.max(1, overviewStats.totalGrants);
                return (
                  <div key={status.value}>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{status.label}</span>
                      <span>{count}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-700"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Календар
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(calendar.year, calendar.month).toLocaleDateString(
                    "uk-UA",
                    { month: "long", year: "numeric" }
                  )}
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                Наступна стипендія: {overviewStats.nextExpectedMonth}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  ← Попередній
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                  }
                  className="text-xs font-semibold text-slate-500"
                >
                  Сьогодні
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  Наступний →
                </button>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2 text-[11px] text-slate-500">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((label) => (
                  <div key={label} className="text-center font-semibold">
                    {label}
                  </div>
                ))}
                {calendar.cells.map((cell) => (
                  <div
                    key={cell.key}
                    title={
                      cell.day
                        ? [
                            cell.events?.payments
                              ? `Стипендія: ${formatAmount(
                                  cell.events.netSum,
                                  "UAH"
                                )}`
                              : null,
                            ...(cell.events?.grants?.map(
                              (grant) => `Грант: ${grant.title}`
                            ) ?? []),
                          ]
                            .filter(Boolean)
                            .join("\n")
                        : undefined
                    }
                    className={`min-h-[48px] rounded-lg border border-transparent p-1 text-center ${
                      cell.day ? "bg-white" : "bg-transparent"
                    }`}
                  >
                  <div
                    className="flex h-full flex-col items-center justify-between"
                  >
                    {cell.day ? (
                      <>
                        <span className="text-xs font-semibold text-slate-700">
                          {cell.day}
                        </span>
                        <div className="flex items-center gap-1">
                          {cell.events?.payments ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          ) : null}
                          {cell.events?.grants?.length ? (
                            <Link
                              href={`/finance/grants?highlight=${cell.events.grants[0].id}`}
                              className="h-1.5 w-1.5 rounded-full bg-rose-500"
                            />
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Стипендія
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Дедлайн гранту
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {view === "scholarships" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Стипендія</h3>
            <p className="mt-1 text-xs text-slate-500">
              Щомісячні виплати: сума до податків, сума на руки та податки.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <select
              value={paymentYear}
              onChange={(event) => setPaymentYear(event.target.value)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs"
            >
              <option value="all">Усі роки</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportPayments}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              Експорт CSV
            </button>
            <span>Усього (gross): {formatAmount(totals.gross)}</span>
            <span>Net: {formatAmount(totals.net)}</span>
            <span>Податки: {formatAmount(totals.tax)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {payments.length === 0 ? (
            <p className="text-sm text-slate-600">Поки немає виплат.</p>
          ) : (
            payments.map((payment) => (
              <div
                key={payment._id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {payment.period ?? "Місяць"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Дата: {formatDate(payment.paidAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>Gross: {formatAmount(payment.grossAmount, payment.currency)}</span>
                    <span>Net: {formatAmount(payment.netAmount, payment.currency)}</span>
                    <span>Tax: {formatAmount(payment.taxAmount, payment.currency)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPayment({ ...payment })}
                      className="rounded-full border border-slate-200 p-2 text-slate-600"
                      title="Редагувати"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchivePayment(payment._id)}
                      className="rounded-full border border-rose-200 p-2 text-rose-600"
                      title="Архівувати"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {payment.notes ? (
                  <RichTextViewer value={payment.notes} className="mt-2" />
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowCreatePayment((prev) => !prev)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            {showCreatePayment ? "Закрити" : "Додати виплату"}
          </button>
          <FormReveal open={showCreatePayment}>
            <form
              ref={paymentFormRef}
              className="grid gap-3 md:grid-cols-3"
              onSubmit={handleCreatePayment}
            >
              <input
                type="month"
                value={paymentForm.period}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, period: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={paymentForm.paidAt}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, paidAt: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={paymentForm.currency}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, currency: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={paymentForm.grossAmount}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    grossAmount: event.target.value,
                  }))
                }
                placeholder="Сума до податків"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={paymentForm.netAmount}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, netAmount: event.target.value }))
                }
                placeholder="Сума на руки"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={paymentForm.taxAmount}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, taxAmount: event.target.value }))
                }
                placeholder="Податки"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="md:col-span-2">
                <RichTextEditor
                  value={paymentForm.notes}
                  onChange={(value) =>
                    setPaymentForm((prev) => ({ ...prev, notes: value }))
                  }
                  placeholder="Нотатки"
                />
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-1">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      period: monthValue(),
                      paidAt: new Date().toISOString().slice(0, 10),
                    }))
                  }
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Поточний місяць
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Додати виплату
                </button>
              </div>
            </form>
          </FormReveal>
        </div>
      </section>
      ) : null}

      {view === "grants" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Гранти</h3>
            <p className="mt-1 text-xs text-slate-500">
              Активні, у підготовці та заплановані гранти з дедлайнами.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={grantStatusFilter}
              onChange={(event) => setGrantStatusFilter(event.target.value)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs"
            >
              <option value="all">Усі статуси</option>
              {grantStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportGrants}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              Експорт CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {grantStatuses
            .filter((status) =>
              grantStatusFilter === "all" ? true : status.value === grantStatusFilter
            )
            .map((status) => (
            <div key={status.value} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">{status.label}</p>
              <div className="mt-3 space-y-3">
                {(groupedGrants[status.value] ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500">Немає записів.</p>
                ) : (
                  groupedGrants[status.value]?.map((grant) => (
                    <div
                      key={grant._id}
                      id={`grant-${grant._id}`}
                      className={`rounded-xl border bg-slate-50 p-3 ${
                        highlightGrantId === grant._id
                          ? "border-amber-300 ring-2 ring-amber-200"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {grant.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {grant.organization || "Організація"} · {grant.country || "Країна"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingGrant({ ...grant })}
                            className="rounded-full border border-slate-200 p-2 text-slate-600"
                            title="Редагувати"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveGrant(grant._id)}
                            className="rounded-full border border-rose-200 p-2 text-rose-600"
                            title="Архівувати"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        <p>Дедлайн: {formatDate(grant.deadlineAt)}</p>
                        <p>План подачі: {formatDate(grant.plannedSubmissionAt)}</p>
                        <p>
                          Сума: {formatAmount(grant.amount, grant.currency ?? "UAH")}
                        </p>
                      </div>
                      {grant.description ? (
                        <RichTextViewer value={grant.description} className="mt-2" />
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowCreateGrant((prev) => !prev)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            {showCreateGrant ? "Закрити" : "Додати грант"}
          </button>
          <FormReveal open={showCreateGrant}>
            <form
              ref={grantFormRef}
              className="grid gap-3 md:grid-cols-2"
              onSubmit={handleCreateGrant}
            >
              <input
                required
                value={grantForm.title}
                onChange={(event) =>
                  setGrantForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Назва гранту"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={grantForm.status}
                onChange={(event) =>
                  setGrantForm((prev) => ({ ...prev, status: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {grantStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <input
                value={grantForm.organization}
                onChange={(event) =>
                  setGrantForm((prev) => ({
                    ...prev,
                    organization: event.target.value,
                  }))
                }
                placeholder="Організація"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={grantForm.country}
                onChange={(event) =>
                  setGrantForm((prev) => ({ ...prev, country: event.target.value }))
                }
                placeholder="Країна"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="md:col-span-2">
                <RichTextEditor
                  value={grantForm.description}
                  onChange={(value) =>
                    setGrantForm((prev) => ({ ...prev, description: value }))
                  }
                  placeholder="Опис"
                />
              </div>
              <div className="md:col-span-2">
                <RichTextEditor
                  value={grantForm.documents}
                  onChange={(value) =>
                    setGrantForm((prev) => ({ ...prev, documents: value }))
                  }
                  placeholder="Документи для подачі"
                />
              </div>
              <input
                type="date"
                value={grantForm.deadlineAt}
                onChange={(event) =>
                  setGrantForm((prev) => ({ ...prev, deadlineAt: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={grantForm.plannedSubmissionAt}
                onChange={(event) =>
                  setGrantForm((prev) => ({
                    ...prev,
                    plannedSubmissionAt: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={grantForm.amount}
                onChange={(event) =>
                  setGrantForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                placeholder="Сума"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={grantForm.currency}
                onChange={(event) =>
                  setGrantForm((prev) => ({ ...prev, currency: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <div className="md:col-span-2">
                <RichTextEditor
                  value={grantForm.notes}
                  onChange={(value) =>
                    setGrantForm((prev) => ({ ...prev, notes: value }))
                  }
                  placeholder="Нотатки"
                />
              </div>
              <div className="flex justify-end md:col-span-2">
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Додати грант
                </button>
              </div>
            </form>
          </FormReveal>
        </div>
      </section>
      ) : null}

      {editingPayment && view === "scholarships" ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setEditingPayment(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_40px_90px_rgba(15,23,42,0.25)]">
            <h3 className="text-lg font-semibold text-slate-900">Редагувати виплату</h3>
            <div className="mt-4 grid gap-2">
              <input
                type="month"
                value={editingPayment.period ?? ""}
                onChange={(event) =>
                  setEditingPayment((prev) =>
                    prev ? { ...prev, period: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={editingPayment.paidAt?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  setEditingPayment((prev) =>
                    prev ? { ...prev, paidAt: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={editingPayment.grossAmount ?? 0}
                onChange={(event) =>
                  setEditingPayment((prev) =>
                    prev
                      ? { ...prev, grossAmount: Number(event.target.value) }
                      : prev
                  )
                }
                placeholder="Сума до податків"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={editingPayment.netAmount ?? 0}
                onChange={(event) =>
                  setEditingPayment((prev) =>
                    prev
                      ? { ...prev, netAmount: Number(event.target.value) }
                      : prev
                  )
                }
                placeholder="Сума на руки"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={editingPayment.taxAmount ?? 0}
                onChange={(event) =>
                  setEditingPayment((prev) =>
                    prev
                      ? { ...prev, taxAmount: Number(event.target.value) }
                      : prev
                  )
                }
                placeholder="Податки"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={editingPayment.currency ?? "UAH"}
                onChange={(event) =>
                  setEditingPayment((prev) =>
                    prev ? { ...prev, currency: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <RichTextEditor
                value={editingPayment.notes ?? ""}
                onChange={(value) =>
                  setEditingPayment((prev) =>
                    prev ? { ...prev, notes: value } : prev
                  )
                }
                placeholder="Нотатки"
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleUpdatePayment}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingGrant && view === "grants" ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setEditingGrant(null)}
          />
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_40px_90px_rgba(15,23,42,0.25)]">
            <h3 className="text-lg font-semibold text-slate-900">Редагувати грант</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={editingGrant.title}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev ? { ...prev, title: event.target.value } : prev
                  )
                }
                placeholder="Назва"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={editingGrant.status ?? "planned"}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev ? { ...prev, status: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {grantStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <input
                value={editingGrant.organization ?? ""}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev ? { ...prev, organization: event.target.value } : prev
                  )
                }
                placeholder="Організація"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={editingGrant.country ?? ""}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev ? { ...prev, country: event.target.value } : prev
                  )
                }
                placeholder="Країна"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={editingGrant.deadlineAt?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev ? { ...prev, deadlineAt: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={editingGrant.plannedSubmissionAt?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev
                      ? { ...prev, plannedSubmissionAt: event.target.value }
                      : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={editingGrant.amount ?? 0}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev
                      ? { ...prev, amount: Number(event.target.value) }
                      : prev
                  )
                }
                placeholder="Сума"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={editingGrant.currency ?? "UAH"}
                onChange={(event) =>
                  setEditingGrant((prev) =>
                    prev ? { ...prev, currency: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <div className="md:col-span-2">
                <RichTextEditor
                  value={editingGrant.description ?? ""}
                  onChange={(value) =>
                    setEditingGrant((prev) =>
                      prev ? { ...prev, description: value } : prev
                    )
                  }
                  placeholder="Опис"
                />
              </div>
              <div className="md:col-span-2">
                <RichTextEditor
                  value={editingGrant.documents ?? ""}
                  onChange={(value) =>
                    setEditingGrant((prev) =>
                      prev ? { ...prev, documents: value } : prev
                    )
                  }
                  placeholder="Документи"
                />
              </div>
              <div className="md:col-span-2">
                <RichTextEditor
                  value={editingGrant.notes ?? ""}
                  onChange={(value) =>
                    setEditingGrant((prev) =>
                      prev ? { ...prev, notes: value } : prev
                    )
                  }
                  placeholder="Нотатки"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditingGrant(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleUpdateGrant}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
