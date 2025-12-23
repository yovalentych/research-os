"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";

type NotificationEntry = {
  id: string;
  type: "audit" | "deadline" | "status" | "overdue";
  title: string;
  timestamp: string;
  actor?: { name?: string; email?: string } | null;
  project?: string;
  details?: { from?: unknown; to?: unknown };
  href?: string;
};

const STORAGE_KEY = "research-os:lastSeenAudit";

export function NotificationsBell() {
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<NotificationEntry[]>([]);
  const lastSeenRef = useRef<Date | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(
    null
  );

  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [entries]);

  const hasOverdue = useMemo(
    () => entries.some((entry) => entry.type === "overdue"),
    [entries]
  );

  function readLastSeen() {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function writeLastSeen(date: Date) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, date.toISOString());
  }

  async function loadNotifications() {
    const response = await fetch("/api/notifications?limit=15");
    if (!response.ok) return;
    const data = await response.json();
    const items = data.items ?? [];
    setEntries(items);

    const lastSeen = lastSeenRef.current ?? readLastSeen();
    if (!lastSeen) {
      lastSeenRef.current = new Date();
      return;
    }

    const fresh = items.filter(
      (entry: NotificationEntry) => new Date(entry.timestamp) > lastSeen
    );

    if (fresh.length) {
      setUnread(fresh.length);
      fresh.slice(0, 3).forEach((entry: NotificationEntry) => {
        setToasts((prev) => [...prev, entry]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== entry.id));
        }, 4000);
      });
    }
  }

  function updatePopoverPosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = 288;
    const left = Math.max(8, rect.right - width);
    const top = rect.bottom + 12;
    setPopoverPos({ top, left });
  }

  useEffect(() => {
    lastSeenRef.current = readLastSeen();
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    const handleScroll = () => updatePopoverPosition();
    const handleResize = () => updatePopoverPosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            updatePopoverPosition();
          }
          if (next) {
            const now = new Date();
            lastSeenRef.current = now;
            writeLastSeen(now);
            setUnread(0);
          }
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
        {hasOverdue ? (
          <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
        ) : null}
      </button>

      {open && popoverPos
        ? createPortal(
            <div
              className="fixed z-[200] w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
              style={{ top: popoverPos.top, left: popoverPos.left }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Нотифікації
              </p>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                {sortedEntries.length === 0 ? (
                  <p className="text-slate-500">Поки немає подій.</p>
                ) : (
                  sortedEntries.slice(0, 5).map((entry) => {
                    const content = (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="font-semibold text-slate-800">{entry.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {entry.actor?.name ??
                            entry.actor?.email ??
                            entry.project ??
                            "Невідомо"}{" "}
                          ·{" "}
                          {new Date(entry.timestamp).toLocaleTimeString("uk-UA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {entry.type === "overdue" ? (
                          <span className="mt-1 inline-flex rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Прострочено
                          </span>
                        ) : null}
                      </div>
                    );

                    return entry.href ? (
                      <Link
                        key={entry.id}
                        href={entry.href}
                        onClick={() => setOpen(false)}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={entry.id}>{content}</div>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}

      {toasts.length ? (
        <div className="fixed right-6 top-24 z-50 space-y-2">
          {toasts.map((entry) => (
            <div
              key={entry.id}
              className="w-72 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-lg"
            >
              <p className="font-semibold text-slate-900">
                {entry.title}
              </p>
              <p className="text-[11px] text-slate-500">
                {entry.actor?.name ?? entry.actor?.email ?? entry.project ?? "Невідомо"}
              </p>
              {entry.type === "overdue" ? (
                <span className="mt-1 inline-flex rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Прострочено
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
