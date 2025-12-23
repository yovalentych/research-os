"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { RichTextEditor } from "./rich-text-editor";
import { knowledgeBaseCategories } from "@/lib/knowledge-base-categories";

type Project = { _id: string; title: string };
type User = { _id: string; fullName?: string; email?: string };

type FormState = {
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string;
  visibility: "private" | "shared";
  sharedProjectIds: string[];
  sharedUserIds: string[];
};

const templates = [
  { label: "Протокол", html: "<h2>Протокол</h2><p></p>" },
  { label: "Методи", html: "<h2>Методи</h2><p></p>" },
  { label: "Результати", html: "<h2>Результати</h2><p></p>" },
  { label: "Safety", html: "<h2>Безпека</h2><ul><li></li></ul>" },
];

export function KnowledgeBaseWizard() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale ?? "uk";
  const [form, setForm] = useState<FormState>({
    title: "",
    category: knowledgeBaseCategories[0],
    summary: "",
    content: "",
    tags: "",
    visibility: "private",
    sharedProjectIds: [],
    sharedUserIds: [],
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/projects?includeArchived=1")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setProjects(data))
      .catch(() => undefined);
    fetch("/api/users")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setUsers(data))
      .catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setStatusMessage("Додай назву для запису");
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);

    const payload = {
      title: form.title.trim(),
      category: form.category,
      summary: form.summary,
      content: form.content,
      visibility: form.visibility,
      sharedProjectIds: form.sharedProjectIds,
      sharedUserIds: form.sharedUserIds,
      tags: form.tags
        ? form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [],
    };

    try {
      const response = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatusMessage(data.error ?? "Не вдалося створити запис");
        return;
      }

      router.push(`/${locale}/knowledge-base`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Майстер</p>
          <h1 className="text-2xl font-semibold text-slate-900">Новий запис</h1>
          <p className="text-sm text-slate-600">
            Повноцінний робочий простір з шаблонами, редактором та історією.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/knowledge-base`)}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Повернутися до бази
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="Назва"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {knowledgeBaseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={form.summary}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, summary: event.target.value }))
            }
            placeholder="Коротке резюме / ціль запису"
            rows={3}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
          />
          <RichTextEditor
            value={form.content}
            onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
            placeholder="Розгорнутий текст"
            templates={templates}
            className="min-h-[280px] rounded-2xl border border-slate-200 bg-white p-2"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.tags}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, tags: event.target.value }))
              }
              placeholder="Теги (через кому)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              value={form.visibility}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, visibility: event.target.value as FormState["visibility"] }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="private">Приватно</option>
              <option value="shared">Спільний доступ</option>
            </select>
          </div>
          {form.visibility === "shared" ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Доступ по проєктах
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {projects.map((project) => (
                    <label key={project._id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.sharedProjectIds.includes(project._id)}
                        onChange={(event) => {
                          setForm((prev) => {
                            const set = new Set(prev.sharedProjectIds);
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
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Доступ по користувачах
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {users.map((user) => (
                    <label key={user._id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.sharedUserIds.includes(user._id)}
                        onChange={(event) => {
                          setForm((prev) => {
                            const set = new Set(prev.sharedUserIds);
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
            </div>
          ) : null}
          {statusMessage ? (
            <p className="text-sm text-rose-600">{statusMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? "Зберігаю…" : "Зберегти й повернутись"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/knowledge-base`)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Відмінити
            </button>
          </div>
        </form>
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Що отримуєш
          </p>
          <ul className="mt-3 space-y-2">
            <li>✅ Повнофункціональний редактор із RichText.</li>
            <li>✅ Шаблони вступу, методів, результатів, безпеки.</li>
            <li>✅ Фіксація тегів і спільного доступу.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
