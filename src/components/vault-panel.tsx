"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type Project = { _id: string; title: string };
type Folder = {
  _id: string;
  name: string;
  color?: string;
  projectId?: string;
};
type FileItem = {
  _id: string;
  name: string;
  mimeType?: string;
  size?: number;
  tags?: string[];
  notes?: string;
  folderIds?: string[];
  projectId: string;
  createdAt?: string;
};

const folderColors = [
  "slate",
  "emerald",
  "amber",
  "sky",
  "violet",
  "rose",
];

const colorClasses: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  sky: "bg-sky-100 text-sky-700 border-sky-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
};

const colorDots: Record<string, string> = {
  slate: "bg-slate-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

export function VaultPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [folderForm, setFolderForm] = useState({
    name: "",
    color: "slate",
    projectId: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = usePersistentToggle(
    "form:vault:create-folder",
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreateFolder, formRef);

  async function loadProjects() {
    const response = await fetch("/api/projects?includeArchived=1");
    if (response.ok) {
      setProjects(await response.json());
    }
  }

  async function loadFolders() {
    const response = await fetch(
      `/api/vault/folders${projectFilter ? `?projectId=${projectFilter}` : ""}`
    );
    if (response.ok) {
      setFolders(await response.json());
    }
  }

  async function loadFiles() {
    const response = await fetch(
      `/api/vault/files${projectFilter ? `?projectId=${projectFilter}` : ""}`
    );
    if (response.ok) {
      setFiles(await response.json());
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [projectFilter]);

  const folderOptions = useMemo(() => {
    return folders.filter(
      (folder) =>
        !folder.projectId || folder.projectId === projectFilter || !projectFilter
    );
  }, [folders, projectFilter]);

  async function handleSaveFile(file: FileItem) {
    setMessage(null);
    const response = await fetch(`/api/files/${file._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: file.notes ?? "",
        tags: file.tags ?? [],
        folderIds: file.folderIds ?? [],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося зберегти файл");
      return;
    }

    loadFiles();
  }

  async function handleDownload(fileId: string) {
    const response = await fetch(`/api/files/download?fileId=${fileId}`);
    if (!response.ok) {
      setMessage("Не вдалося отримати посилання");
      return;
    }
    const data = await response.json();
    if (data.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/vault/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderForm.name,
        color: folderForm.color,
        projectId: folderForm.projectId || undefined,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити папку");
      return;
    }

    setFolderForm({ name: "", color: "slate", projectId: folderForm.projectId });
    loadFolders();
  }

  async function handleArchiveFolder(id: string) {
    setMessage(null);
    const response = await fetch(`/api/vault/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати папку");
      return;
    }

    loadFolders();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Сховище</h3>
            <p className="mt-1 text-xs text-slate-500">
              Хронологія файлів з коментарями та мітками.
            </p>
          </div>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs"
          >
            <option value="">Усі проєкти</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {files.length === 0 ? (
            <p className="text-sm text-slate-600">Поки немає файлів.</p>
          ) : (
            files.map((file) => (
              <div
                key={file._id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {projects.find((p) => p._id === file.projectId)?.title ??
                        "Проєкт"}{" "}
                      ·{" "}
                      {file.createdAt
                        ? new Date(file.createdAt).toLocaleDateString("uk-UA")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(file._id)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      Завантажити
                    </button>
                  </div>
                </div>
                <RichTextEditor
                  value={file.notes ?? ""}
                  onChange={(value) =>
                    setFiles((prev) =>
                      prev.map((entry) =>
                        entry._id === file._id
                          ? { ...entry, notes: value }
                          : entry
                      )
                    )
                  }
                  className="mt-3"
                  placeholder="Коментар"
                />
                <input
                  value={(file.tags ?? []).join(", ")}
                  onChange={(event) =>
                    setFiles((prev) =>
                      prev.map((entry) =>
                        entry._id === file._id
                          ? {
                              ...entry,
                              tags: event.target.value
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean),
                            }
                          : entry
                      )
                    )
                  }
                  placeholder="Теги (через кому)"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {folderOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Немає папок-міток.
                    </p>
                  ) : (
                    folderOptions.map((folder) => (
                      <label key={folder._id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={file.folderIds?.includes(folder._id) ?? false}
                          onChange={(event) => {
                            setFiles((prev) =>
                              prev.map((entry) => {
                                if (entry._id !== file._id) return entry;
                                const set = new Set(entry.folderIds ?? []);
                                if (event.target.checked) {
                                  set.add(folder._id);
                                } else {
                                  set.delete(folder._id);
                                }
                                return { ...entry, folderIds: Array.from(set) };
                              })
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            colorClasses[folder.color ?? "slate"] ??
                            colorClasses.slate
                          }`}
                        >
                          {folder.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => handleSaveFile(file)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Зберегти
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Папки-мітки</h3>
        <p className="mt-2 text-sm text-slate-600">
          Тематичні папки для структурування файлів.
        </p>
        <div className="mt-4 space-y-2">
          {folders.length === 0 ? (
            <p className="text-sm text-slate-600">Поки немає папок.</p>
          ) : (
            folders.map((folder) => (
              <div
                key={folder._id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              >
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    colorClasses[folder.color ?? "slate"] ?? colorClasses.slate
                  }`}
                >
                  {folder.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleArchiveFolder(folder._id)}
                  className="text-xs font-semibold text-rose-600"
                >
                  Архівувати
                </button>
              </div>
            ))
          )}
        </div>
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowCreateFolder((prev) => !prev)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            {showCreateFolder ? "Закрити" : "Додати папку"}
          </button>
          <FormReveal open={showCreateFolder}>
            <form ref={formRef} className="space-y-3" onSubmit={handleCreateFolder}>
              <input
                value={folderForm.name}
                onChange={(event) =>
                  setFolderForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Назва папки"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
              <select
                value={folderForm.projectId}
                onChange={(event) =>
                  setFolderForm((prev) => ({ ...prev, projectId: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Загальна папка</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.title}
                  </option>
                ))}
              </select>
              <select
                value={folderForm.color}
                onChange={(event) =>
                  setFolderForm((prev) => ({ ...prev, color: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {folderColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {folderColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFolderForm((prev) => ({ ...prev, color }))}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      folderForm.color === color
                        ? "border-slate-400 text-slate-800"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        colorDots[color] ?? "bg-slate-400"
                      }`}
                    />
                    {color}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Додати папку
              </button>
            </form>
          </FormReveal>
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
    </div>
  );
}
