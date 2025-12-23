"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type Protocol = {
  _id: string;
  title: string;
  steps?: string[];
  notes?: string;
  version?: string;
};

export function ProjectProtocolsPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [archivedProtocols, setArchivedProtocols] = useState<Protocol[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ title: "", steps: "", notes: "", version: "v1" });
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = usePersistentToggle(
    `form:project-protocols:create:${projectId}`,
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  const templates = [
    { label: "Протокол", html: "<h2>Протокол</h2><p></p>" },
    { label: "Методи", html: "<h3>Методи</h3><p></p>" },
    { label: "Контроль", html: "<h3>Контроль</h3><ul><li></li></ul>" },
  ];

  async function loadProtocols(archived = false) {
    const response = await fetch(
      `/api/projects/${projectId}/protocols${archived ? "?archived=1" : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archived) {
        setArchivedProtocols(data);
      } else {
        setProtocols(data);
      }
    }
  }

  useEffect(() => {
    loadProtocols();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      title: form.title,
      steps: form.steps
        ? form.steps.split("\n").map((step) => step.trim()).filter(Boolean)
        : [],
      notes: form.notes,
      version: form.version,
    };

    const response = await fetch(`/api/projects/${projectId}/protocols`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося додати протокол");
      return;
    }

    setForm({ title: "", steps: "", notes: "", version: "v1" });
    loadProtocols();
  }

  async function handleUpdate(protocol: Protocol) {
    setMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/protocols/${protocol._id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(protocol),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити протокол");
      return;
    }

    loadProtocols();
  }

  async function handleArchive(protocolId: string) {
    setMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/protocols/${protocolId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати протокол");
      return;
    }

    loadProtocols();
    if (showArchived) {
      loadProtocols(true);
    }
  }

  async function handleRestore(protocolId: string) {
    setMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/protocols/${protocolId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити протокол");
      return;
    }

    loadProtocols();
    loadProtocols(true);
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
      <h3 className="text-lg font-semibold">Протоколи</h3>
      <p className="mt-2 text-sm text-stone-600">
        Шаблони та версії методик для колаборації.
      </p>
      <div className="mt-4 space-y-3">
        {protocols.length === 0 ? (
          <p className="text-sm text-stone-600">
            Поки немає протоколів. Додай перший.
          </p>
        ) : (
          protocols.map((protocol) => (
            <div
              key={protocol._id}
              className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4"
            >
              {canEdit ? (
                <input
                  value={protocol.title}
                  onChange={(event) =>
                    setProtocols((prev) =>
                      prev.map((entry) =>
                        entry._id === protocol._id
                          ? { ...entry, title: event.target.value }
                          : entry
                      )
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"
                />
              ) : (
                <p className="text-sm font-semibold text-stone-900">
                  {protocol.title}
                </p>
              )}
              {canEdit ? (
                <textarea
                  value={(protocol.steps ?? []).join("\n")}
                  onChange={(event) =>
                    setProtocols((prev) =>
                      prev.map((entry) =>
                        entry._id === protocol._id
                          ? { ...entry, steps: event.target.value.split("\n") }
                          : entry
                      )
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  rows={3}
                />
              ) : protocol.steps?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
                  {protocol.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              ) : null}
              {canEdit ? (
                <RichTextEditor
                  value={protocol.notes ?? ""}
                  onChange={(value) =>
                    setProtocols((prev) =>
                      prev.map((entry) =>
                        entry._id === protocol._id
                          ? { ...entry, notes: value }
                          : entry
                      )
                    )
                  }
                  className="mt-2"
                  placeholder="Нотатки"
                  templates={templates}
                  uploadContext={{ projectId }}
                />
              ) : protocol.notes ? (
                <RichTextViewer value={protocol.notes} className="mt-2" />
              ) : null}
              {canEdit ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={protocol.version ?? "v1"}
                    onChange={(event) =>
                      setProtocols((prev) =>
                        prev.map((entry) =>
                          entry._id === protocol._id
                            ? { ...entry, version: event.target.value }
                            : entry
                        )
                      )
                    }
                    className="rounded-xl border border-stone-200 bg-white px-3 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(protocol)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700"
                  >
                    Зберегти
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(protocol._id)}
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
                loadProtocols(true);
              }
            }}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedProtocols.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedProtocols.map((protocol) => (
                  <div
                    key={protocol._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{protocol.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(protocol._id)}
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
            {showCreate ? "Закрити" : "Додати протокол"}
          </button>
          <FormReveal open={showCreate}>
            <form ref={formRef} className="space-y-3" onSubmit={handleCreate}>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Назва протоколу"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                required
              />
              <textarea
                value={form.steps}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, steps: event.target.value }))
                }
                placeholder="Кроки (кожен з нового рядка)"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                rows={3}
              />
              <RichTextEditor
                value={form.notes}
                onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                placeholder="Нотатки до протоколу"
                templates={templates}
                uploadContext={{ projectId }}
              />
              <input
                value={form.version}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, version: event.target.value }))
                }
                placeholder="Версія"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
              >
                Додати протокол
              </button>
            </form>
          </FormReveal>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}
