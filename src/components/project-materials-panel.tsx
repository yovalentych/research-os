"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type Material = {
  _id: string;
  name: string;
  description?: string;
  quantity?: number;
  unit?: string;
  status?: string;
};

const statusOptions = ["planned", "ordered", "available", "used"];

export function ProjectMaterialsPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [archivedMaterials, setArchivedMaterials] = useState<Material[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    quantity: "",
    unit: "",
    status: "planned",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = usePersistentToggle(
    `form:project-materials:create:${projectId}`,
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  async function loadMaterials(archived = false) {
    const response = await fetch(
      `/api/projects/${projectId}/materials${archived ? "?archived=1" : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archived) {
        setArchivedMaterials(data);
      } else {
        setMaterials(data);
      }
    }
  }

  useEffect(() => {
    loadMaterials();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      name: form.name,
      description: form.description,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      unit: form.unit,
      status: form.status,
    };

    const response = await fetch(`/api/projects/${projectId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося додати матеріал");
      return;
    }

    setForm({ name: "", description: "", quantity: "", unit: "", status: "planned" });
    loadMaterials();
  }

  async function handleUpdate(material: Material) {
    setMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/materials/${material._id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(material),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити матеріал");
      return;
    }

    loadMaterials();
  }

  async function handleArchive(materialId: string) {
    setMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/materials/${materialId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати матеріал");
      return;
    }

    loadMaterials();
    if (showArchived) {
      loadMaterials(true);
    }
  }

  async function handleRestore(materialId: string) {
    setMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/materials/${materialId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити матеріал");
      return;
    }

    loadMaterials();
    loadMaterials(true);
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
      <h3 className="text-lg font-semibold">Матеріали</h3>
      <p className="mt-2 text-sm text-stone-600">
        Реагенти, оліго, інструменти та ресурси для проєкту.
      </p>
      <div className="mt-4 space-y-3">
        {materials.length === 0 ? (
          <p className="text-sm text-stone-600">
            Поки немає матеріалів. Додай перший.
          </p>
        ) : (
          materials.map((material) => (
            <div
              key={material._id}
              className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4"
            >
              {canEdit ? (
                <input
                  value={material.name}
                  onChange={(event) =>
                    setMaterials((prev) =>
                      prev.map((entry) =>
                        entry._id === material._id
                          ? { ...entry, name: event.target.value }
                          : entry
                      )
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"
                />
              ) : (
                <p className="text-sm font-semibold text-stone-900">
                  {material.name}
                </p>
              )}
              {canEdit ? (
                <RichTextEditor
                  value={material.description ?? ""}
                  onChange={(value) =>
                    setMaterials((prev) =>
                      prev.map((entry) =>
                        entry._id === material._id
                          ? { ...entry, description: value }
                          : entry
                      )
                    )
                  }
                  className="mt-2"
                  placeholder="Опис матеріалу"
                  uploadContext={{ projectId }}
                />
              ) : material.description ? (
                <RichTextViewer value={material.description} className="mt-2" />
              ) : null}
              {canEdit ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input
                    value={material.quantity ?? ""}
                    onChange={(event) =>
                      setMaterials((prev) =>
                        prev.map((entry) =>
                          entry._id === material._id
                            ? {
                                ...entry,
                                quantity: Number(event.target.value),
                              }
                            : entry
                        )
                      )
                    }
                    placeholder="К-сть"
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={material.unit ?? ""}
                    onChange={(event) =>
                      setMaterials((prev) =>
                        prev.map((entry) =>
                          entry._id === material._id
                            ? { ...entry, unit: event.target.value }
                            : entry
                        )
                      )
                    }
                    placeholder="Одиниця"
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={material.status ?? "planned"}
                    onChange={(event) =>
                      setMaterials((prev) =>
                        prev.map((entry) =>
                          entry._id === material._id
                            ? { ...entry, status: event.target.value }
                            : entry
                        )
                      )
                    }
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {canEdit ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(material)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700"
                  >
                    Зберегти
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(material._id)}
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
                loadMaterials(true);
              }
            }}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedMaterials.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedMaterials.map((material) => (
                  <div
                    key={material._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{material.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(material._id)}
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
            {showCreate ? "Закрити" : "Додати матеріал"}
          </button>
          <FormReveal open={showCreate}>
            <form ref={formRef} className="space-y-3" onSubmit={handleCreate}>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Назва матеріалу"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                required
              />
              <RichTextEditor
                value={form.description}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, description: value }))
                }
                placeholder="Опис"
                uploadContext={{ projectId }}
              />
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  placeholder="К-сть"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
                <input
                  value={form.unit}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, unit: event.target.value }))
                  }
                  placeholder="Одиниця"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
              >
                Додати матеріал
              </button>
            </form>
          </FormReveal>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}
