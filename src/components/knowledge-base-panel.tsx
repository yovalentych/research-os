"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RichTextEditor } from "./rich-text-editor";
import { knowledgeBaseCategories } from "@/lib/knowledge-base-categories";

type Entry = {
  _id: string;
  title: string;
  category?: string;
  content?: string;
  tags?: string[];
  visibility?: "private" | "shared";
  sharedProjectIds?: string[];
  sharedUserIds?: string[];
};

export function KnowledgeBasePanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [archived, setArchived] = useState<Entry[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchTimer, setSearchTimer] = useState<number | null>(null);
  const [projects, setProjects] = useState<{ _id: string; title: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; fullName?: string; email?: string }[]>([]);
  const [attachments, setAttachments] = useState<
    { _id: string; name: string; size?: number }[]
  >([]);
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale ?? "uk";
  const categories = knowledgeBaseCategories;
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Entry[]>();
    categories.forEach((category) => map.set(category, []));
    entries.forEach((entry) => {
      const candidate =
        entry.category && categories.includes(entry.category as string)
          ? entry.category
          : categories[0];
      const list = map.get(candidate)!;
      list.push(entry);
    });
    return categories.map((category) => ({
      category,
      entries: map.get(category) ?? [],
    }));
  }, [entries, categories]);

  const templates = [
    { label: "Протокол", html: "<h2>Протокол</h2><p></p>" },
    { label: "Методи", html: "<h2>Методи</h2><p></p>" },
    { label: "Результати", html: "<h2>Результати</h2><p></p>" },
    { label: "Safety", html: "<h2>Безпека</h2><ul><li></li></ul>" },
  ];

  async function loadEntries(archivedOnly = false) {
    const params = new URLSearchParams();
    if (archivedOnly) {
      params.set("archived", "1");
    }
    if (search.trim()) {
      params.set("q", search.trim());
    }
    const response = await fetch(
      `/api/knowledge-base${params.toString() ? `?${params.toString()}` : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archivedOnly) {
        setArchived(data);
      } else {
        setEntries(data);
      }
    }
  }

  useEffect(() => {
    loadEntries();
    fetch("/api/projects?includeArchived=1")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setProjects(data))
      .catch(() => undefined);
    fetch("/api/users")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setUsers(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }
    const timer = window.setTimeout(() => {
      loadEntries();
    }, 350);
    setSearchTimer(timer);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selected) {
      setAttachments([]);
      return;
    }
    fetch(`/api/knowledge-base/${selected._id}/attachments`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setAttachments(data))
      .catch(() => undefined);
  }, [selected?._id]);

  async function handleSave() {
    if (!selected) return;
    setMessage(null);

    const response = await fetch(`/api/knowledge-base/${selected._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        category: selected.category,
        content: selected.content,
        visibility: selected.visibility,
        sharedProjectIds: selected.sharedProjectIds ?? [],
        sharedUserIds: selected.sharedUserIds ?? [],
        tags: selected.tags ?? [],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося зберегти запис");
      return;
    }

    loadEntries();
  }

  async function handleArchive(id: string) {
    setMessage(null);
    const response = await fetch(`/api/knowledge-base/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати");
      return;
    }

    if (selected?._id === id) {
      setSelected(null);
    }
    loadEntries();
    if (showArchived) {
      loadEntries(true);
    }
  }

  async function handleRestore(id: string) {
    setMessage(null);
    const response = await fetch(`/api/knowledge-base/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити");
      return;
    }

    loadEntries();
    loadEntries(true);
  }

  async function handleUploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    setMessage(null);

    const payload = new FormData();
    payload.append("file", file);

    const response = await fetch(
      `/api/knowledge-base/${selected._id}/attachments`,
      {
        method: "POST",
        body: payload,
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося завантажити файл");
      return;
    }

    const updated = await response.json();
    setAttachments((prev) => [updated, ...prev]);
  }

  async function handleArchiveAttachment(id: string) {
    setMessage(null);
    const response = await fetch(`/api/knowledge-base/attachments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати вкладення");
      return;
    }

    setAttachments((prev) => prev.filter((file) => file._id !== id));
  }

  async function handleDownloadAttachment(id: string) {
    const response = await fetch(
      `/api/knowledge-base/attachments/${id}/download`
    );
    if (!response.ok) {
      setMessage("Не вдалося отримати посилання");
      return;
    }
    const data = await response.json();
    if (data.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">База знань</h3>
            <p className="mt-2 text-sm text-slate-600">
              Протоколи, інструкції та методики в одному місці. Швидкий пошук і
              типізовані картки допоможуть зорієнтуватися.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/knowledge-base/create`)}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Майстер створення
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук"
            className="w-full max-w-xs rounded-full border border-slate-200 px-3 py-2 text-xs"
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupedByCategory.map((group) => (
            <div
              key={group.category}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{group.category}</p>
                <span className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {group.entries.length} записів
                </span>
              </div>
              <div className="mt-3 space-y-1">
                {group.entries.slice(0, 3).map((entry) => (
                  <button
                    key={entry._id}
                    type="button"
                    onClick={() => setSelected(entry)}
                    className="block w-full truncate text-left text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                  >
                    {entry.title}
                  </button>
                ))}
                {!group.entries.length ? (
                  <p className="text-xs text-slate-500">Порожньо</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-600">
              Поки немає записів. Відкрий майстер, щоб додати перший.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry._id}
                className={`flex items-center justify-between rounded-2xl border p-4 ${
                  selected?._id === entry._id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="text-left"
                >
                  <p className="text-sm font-semibold">{entry.title}</p>
                  <p className="text-xs opacity-70">{entry.category}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleArchive(entry._id)}
                  className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                >
                  Архівувати
                </button>
              </div>
            ))
          )}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              const next = !showArchived;
              setShowArchived(next);
              if (next) {
                loadEntries(true);
              }
            }}
            className="text-xs font-semibold text-slate-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archived.length === 0 ? (
                <p className="text-xs text-slate-500">Архів порожній.</p>
              ) : (
                archived.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <span className="font-semibold">{entry.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRestore(entry._id)}
                      className="text-xs font-semibold text-slate-600"
                    >
                      Відновити
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Редактор</h3>
        {selected ? (
          <div className="mt-4 space-y-3">
            <input
              value={selected.title}
              onChange={(event) =>
                setSelected((prev) =>
                  prev ? { ...prev, title: event.target.value } : prev
                )
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={selected.category ?? categories[0]}
                onChange={(event) =>
                  setSelected((prev) =>
                    prev ? { ...prev, category: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={selected.visibility ?? "private"}
                onChange={(event) =>
                  setSelected((prev) =>
                    prev ? { ...prev, visibility: event.target.value as Entry["visibility"] } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="private">Приватно</option>
                <option value="shared">Спільний доступ</option>
              </select>
            </div>
            {selected.visibility === "shared" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Доступ по проєктах
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {projects.map((project) => (
                    <label key={project._id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          selected.sharedProjectIds?.includes(project._id) ?? false
                        }
                        onChange={(event) => {
                          setSelected((prev) => {
                            if (!prev) return prev;
                            const set = new Set(prev.sharedProjectIds ?? []);
                            if (event.target.checked) {
                              set.add(project._id);
                            } else {
                              set.delete(project._id);
                            }
                            return { ...prev, sharedProjectIds: Array.from(set) };
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{project.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {selected.visibility === "shared" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Доступ по користувачах
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {users.map((user) => (
                    <label key={user._id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.sharedUserIds?.includes(user._id) ?? false}
                        onChange={(event) => {
                          setSelected((prev) => {
                            if (!prev) return prev;
                            const set = new Set(prev.sharedUserIds ?? []);
                            if (event.target.checked) {
                              set.add(user._id);
                            } else {
                              set.delete(user._id);
                            }
                            return { ...prev, sharedUserIds: Array.from(set) };
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{user.fullName ?? user.email ?? "Користувач"}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <RichTextEditor
              value={selected.content ?? ""}
              onChange={(value) =>
                setSelected((prev) => (prev ? { ...prev, content: value } : prev))
              }
              placeholder="Текст інструкції / протоколу"
              templates={templates}
            />
            <input
              value={(selected.tags ?? []).join(", ")}
              onChange={(event) =>
                setSelected((prev) =>
                  prev
                    ? {
                        ...prev,
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      }
                    : prev
                )
              }
              placeholder="Теги (через кому)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Зберегти
              </button>
              <a
                href={`/api/knowledge-base/${selected._id}/export?format=docx`}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                DOCX
              </a>
              <a
                href={`/api/knowledge-base/${selected._id}/export?format=pdf`}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                PDF
              </a>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Вкладення
              </p>
              <div className="mt-2 space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-xs text-slate-500">Немає вкладень.</p>
                ) : (
                  attachments.map((file) => (
                    <div
                      key={file._id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                    >
                      <span className="font-semibold">{file.name}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(file._id)}
                          className="text-xs font-semibold text-slate-600"
                        >
                          Завантажити
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveAttachment(file._id)}
                          className="text-xs font-semibold text-rose-600"
                        >
                          Архівувати
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                Додати файл
                <input type="file" className="hidden" onChange={handleUploadAttachment} />
              </label>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Обери запис для редагування.
          </p>
        )}
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 xl:col-span-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Майстер записів</h3>
            <p className="mt-1 text-sm text-slate-600">
              Відкрий окрему сторінку, щоб працювати з повноцінним редактором,
              шаблонами секцій, історіями та автозаповненням.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/knowledge-base/create`)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Відкрити майстер
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Блоки
            </p>
            <p className="mt-2 text-sm text-slate-900">
              Розділи для вступу, методу, результатів, безпеки та висновків.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Шаблони
            </p>
            <p className="mt-2 text-sm text-slate-900">
              Додавай готові блоки та створюй структуру майбутньої публікації.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Вінтаж
            </p>
            <p className="mt-2 text-sm text-slate-900">
              Велика область редактора, автозбереження і можливість повернутись
              до історії будь-якої секції.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
