"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type Note = {
  _id: string;
  title: string;
  body?: string;
};

export function ProjectNotesPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = usePersistentToggle(
    `form:project-notes:create:${projectId}`,
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  useAutoFocus(showCreate, formRef);

  const templates = [
    { label: "Методи", html: "<h2>Методи</h2><p></p>" },
    { label: "Результати", html: "<h2>Результати</h2><p></p>" },
    { label: "Обговорення", html: "<h2>Обговорення</h2><p></p>" },
  ];

  async function loadNotes(archived = false) {
    const response = await fetch(
      `/api/projects/${projectId}/notes${archived ? "?archived=1" : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archived) {
        setArchivedNotes(data);
      } else {
        setNotes(data);
      }
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити нотатку");
      return;
    }

    setForm({ title: "", body: "" });
    loadNotes();
  }

  async function handleUpdate(noteId: string, updates: Partial<Note>) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити нотатку");
      return;
    }

    loadNotes();
  }

  async function handleArchive(noteId: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати нотатку");
      return;
    }

    loadNotes();
    if (showArchived) {
      loadNotes(true);
    }
  }

  async function handleRestore(noteId: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити нотатку");
      return;
    }

    loadNotes();
    loadNotes(true);
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
      <h3 className="text-lg font-semibold">Нотатки</h3>
      <p className="mt-2 text-sm text-stone-600">
        Протоколи, рішення зустрічей, контекст колаборації.
      </p>
      <div className="mt-4 space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-stone-600">
            Поки немає нотаток. Додай першу.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note._id}
              className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4"
            >
              {canEdit ? (
                <input
                  value={note.title}
                  onChange={(event) =>
                    setNotes((prev) =>
                      prev.map((entry) =>
                        entry._id === note._id
                          ? { ...entry, title: event.target.value }
                          : entry
                      )
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"
                />
              ) : (
                <p className="text-sm font-semibold text-stone-900">
                  {note.title}
                </p>
              )}
              {canEdit ? (
                <RichTextEditor
                  value={note.body ?? ""}
                  onChange={(value) =>
                    setNotes((prev) =>
                      prev.map((entry) =>
                        entry._id === note._id ? { ...entry, body: value } : entry
                      )
                    )
                  }
                  className="mt-2"
                  placeholder="Текст нотатки"
                  templates={templates}
                  uploadContext={{ projectId }}
                />
              ) : note.body ? (
                <RichTextViewer value={note.body} className="mt-2" />
              ) : null}
              {canEdit ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(note._id, note)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700"
                  >
                    Зберегти
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(note._id)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                  >
                    Архівувати
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      {canEdit ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              const next = !showArchived;
              setShowArchived(next);
              if (next) {
                loadNotes(true);
              }
            }}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedNotes.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedNotes.map((note) => (
                  <div
                    key={note._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{note.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(note._id)}
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
      ) : null}
      {canEdit ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700"
          >
            {showCreate ? "Закрити" : "Додати нотатку"}
          </button>
          <FormReveal open={showCreate}>
            <form ref={formRef} className="space-y-3" onSubmit={handleCreate}>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Назва нотатки"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                required
              />
              <RichTextEditor
                value={form.body}
                onChange={(value) => setForm((prev) => ({ ...prev, body: value }))}
                placeholder="Текст нотатки"
                templates={templates}
                uploadContext={{ projectId }}
              />
              <button
                type="submit"
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
              >
                Додати нотатку
              </button>
            </form>
          </FormReveal>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}
