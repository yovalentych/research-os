"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEntry = {
  _id: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  projectId?: string;
  timestamp: string;
  actor?: { id: string; name?: string; email?: string } | null;
  changes?: { fieldPath: string; oldValue?: unknown; newValue?: unknown }[];
};

type Project = { _id: string; title: string };
type Actor = { _id: string; fullName?: string; email?: string };

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [actorId, setActorId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const limit = 20;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  const formatValue = (value: unknown) => {
    if (value === undefined) return "—";
    if (value === null) return "—";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  };

  const actionTone = (value: AuditEntry["action"]) => {
    if (value === "create") {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
    if (value === "update") {
      return "bg-amber-100 text-amber-700 border-amber-200";
    }
    return "bg-rose-100 text-rose-700 border-rose-200";
  };

  const previewLine = (entry: AuditEntry) => {
    if (!entry.changes?.length) {
      return "Деталі змін не зафіксовані.";
    }
    const snippets = entry.changes.slice(0, 2).map((change) => {
      return `${change.fieldPath}: ${formatValue(change.oldValue)} → ${formatValue(
        change.newValue
      )}`;
    });
    return `${snippets.join(" · ")}${entry.changes.length > 2 ? " · +" : ""}`;
  };

  async function loadLogs(nextPage = page) {
    const params = new URLSearchParams({
      limit: String(limit),
      page: String(nextPage),
    });
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (projectId) params.set("projectId", projectId);
    if (actorId) params.set("actorId", actorId);
    if (query.trim()) params.set("q", query.trim());

    const response = await fetch(`/api/audit?${params.toString()}`);
    if (!response.ok) {
      setMessage("Не вдалося завантажити журнал змін");
      return;
    }
    const data = await response.json();
    setEntries(data.items ?? []);
    setTotal(data.total ?? 0);
    setPage(data.page ?? nextPage);
  }

  useEffect(() => {
    loadLogs();
    fetch("/api/projects?includeArchived=1")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setProjects(data))
      .catch(() => undefined);
    fetch("/api/users")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setActors(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!projectQuery) {
      setProjectId("");
      return;
    }
    const match = projects.find(
      (project) => project.title.toLowerCase() === projectQuery.toLowerCase()
    );
    setProjectId(match?._id ?? "");
  }, [projectQuery, projects]);

  useEffect(() => {
    loadLogs(1);
  }, [action, entityType, projectId, actorId]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Журнал змін</h3>
            <p className="mt-1 text-xs text-slate-200">
              Повна історія подій та змін у системі.
            </p>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs">
            Усього подій: {total}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              loadLogs(1);
            }
          }}
          placeholder="Пошук"
          className="w-44 rounded-full border border-slate-200 px-3 py-1 text-xs"
        />
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
        >
          <option value="">Усі дії</option>
          <option value="create">create</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
        </select>
        <input
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          placeholder="Entity"
          className="w-32 rounded-full border border-slate-200 px-3 py-1 text-xs"
        />
        <div className="relative">
          <input
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder="Проєкт"
            list="audit-projects"
            className="w-44 rounded-full border border-slate-200 px-3 py-1 text-xs"
          />
          <datalist id="audit-projects">
            {projects.map((project) => (
              <option key={project._id} value={project.title} />
            ))}
          </datalist>
        </div>
        <select
          value={actorId}
          onChange={(event) => setActorId(event.target.value)}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs"
        >
          <option value="">Усі автори</option>
          {actors.map((actor) => (
            <option key={actor._id} value={actor._id}>
              {actor.fullName ?? actor.email ?? "Автор"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => loadLogs(1)}
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Застосувати
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-600">Поки немає подій.</p>
        ) : (
          entries.map((entry) => {
            const isOpen = openId === entry._id;
            return (
              <div
                key={entry._id}
                className={`group rounded-2xl border border-slate-200 bg-white shadow-sm transition ${
                  isOpen ? "ring-1 ring-slate-200" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenId((current) =>
                      current === entry._id ? null : entry._id
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${actionTone(
                        entry.action
                      )}`}
                    >
                      {entry.action}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.entityType}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.actor?.name ??
                          entry.actor?.email ??
                          "Невідомий користувач"}{" "}
                        ·{" "}
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString("uk-UA")
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500">
                      {entry.changes?.length
                        ? `${entry.changes.length} змін`
                        : "Без деталей"}
                    </span>
                    <span className="max-w-[180px] truncate rounded-full border border-slate-200 px-3 py-1 font-mono text-[10px] text-slate-400">
                      {entry.entityId}
                    </span>
                    <span
                      className={`text-lg text-slate-400 transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </div>
                </button>
                <div className="px-4 pb-3 text-[11px] text-slate-500">
                  {previewLine(entry)}
                </div>
                <div
                  className={`overflow-hidden border-t border-slate-100 transition-all duration-300 ease-out ${
                    isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-4 py-4">
                    {entry.changes?.length ? (
                      <div className="space-y-2 text-xs text-slate-600">
                        {entry.changes.map((change, index) => (
                          <div
                            key={`${entry._id}-${index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              {change.fieldPath}
                            </p>
                            <div className="mt-1 grid gap-2 md:grid-cols-2">
                              <div>
                                <p className="text-[11px] text-slate-400">Було</p>
                                <p className="text-xs text-slate-600">
                                  {formatValue(change.oldValue)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] text-slate-400">
                                  Стало
                                </p>
                                <p className="text-xs text-slate-600">
                                  {formatValue(change.newValue)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Деталі змін не зафіксовані.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          Сторінка {page} з {totalPages} · Усього {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadLogs(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => loadLogs(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-50"
          >
            Далі
          </button>
        </div>
      </div>
      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
