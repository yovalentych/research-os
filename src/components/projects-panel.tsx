"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";
import Link from "next/link";

type Project = {
  _id: string;
  title: string;
  description?: string;
  status?: string;
};

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [showCreate, setShowCreate] = usePersistentToggle(
    "form:projects:create",
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  async function fetchProjects(archived = false) {
    setLoading(true);
    const response = await fetch(
      `/api/projects${archived ? "?archived=1" : ""}`
    );
    if (!response.ok) {
      setMessage("Не вдалося завантажити проєкти");
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (archived) {
      setArchivedProjects(data);
    } else {
      setProjects(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити проєкт");
      return;
    }

    setForm({ title: "", description: "" });
    fetchProjects();
  }

  async function handleArchive(id: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати проєкт");
      return;
    }

    fetchProjects();
    if (showArchived) {
      fetchProjects(true);
    }
  }

  async function handleRestore(id: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити проєкт");
      return;
    }

    fetchProjects();
    fetchProjects(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h3 className="text-xl font-semibold">Проєкти</h3>
        <p className="mt-2 text-sm text-stone-600">
          Список активних колаборацій та робочих напрямків.
        </p>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-stone-500">Завантаження…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-stone-600">
              Поки немає проєктів. Створи перший.
            </p>
          ) : (
            projects.map((project) => (
              <div
                key={project._id}
                className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4 transition hover:border-stone-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/uk/projects/${project._id}`}
                    className="min-w-0"
                  >
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {project.title}
                    </p>
                    {project.description ? (
                      <p className="mt-1 text-xs text-stone-500">
                        {project.description}
                      </p>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleArchive(project._id)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                  >
                    Архівувати
                  </button>
                </div>
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
                fetchProjects(true);
              }
            }}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedProjects.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedProjects.map((project) => (
                  <div
                    key={project._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{project.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(project._id)}
                        className="text-xs font-semibold text-stone-600"
                      >
                        Відновити
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Новий проєкт</h3>
            <p className="mt-2 text-sm text-stone-600">
              Додай назву, короткий опис і почни наповнювати колаборацію.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700"
          >
            {showCreate ? "Закрити" : "Додати"}
          </button>
        </div>
        <FormReveal open={showCreate}>
          <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-stone-700">
              Назва
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Опис
              <RichTextEditor
                value={form.description}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, description: value }))
                }
                placeholder="Короткий опис проєкту"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
            >
              Створити проєкт
            </button>
            {message ? (
              <p className="text-sm text-rose-600">{message}</p>
            ) : null}
          </form>
        </FormReveal>
      </section>
    </div>
  );
}
