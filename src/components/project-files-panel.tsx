"use client";

import { useEffect, useState } from "react";

type FileItem = {
  _id: string;
  name: string;
  mimeType?: string;
  size?: number;
  storage?: { key: string };
};

export function ProjectFilesPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<FileItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  async function loadFiles(archived = false) {
    const response = await fetch(
      `/api/files?projectId=${projectId}${archived ? "&archived=1" : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      const filtered = data.filter(
        (file: { entityType?: string }) => file.entityType === "Project"
      );
      if (archived) {
        setArchivedFiles(filtered);
      } else {
        setFiles(filtered);
      }
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setProgress(0);
    setBusy(true);

    const payload = new FormData();
    payload.append("projectId", projectId);
    payload.append("entityType", "Project");
    payload.append("entityId", projectId);
    payload.append("file", file);

    const uploadPromise = fetch("/api/files/upload", {
      method: "POST",
      body: payload,
    });

    const timer = window.setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 8 : prev));
    }, 200);

    const upload = await uploadPromise;
    window.clearInterval(timer);

    if (!upload.ok) {
      const data = await upload.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося завантажити файл");
      setBusy(false);
      return;
    }

    setProgress(100);
    setMessage("Файл додано");
    setBusy(false);
    loadFiles();
  }

  async function handleDownload(fileId: string) {
    setMessage(null);
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

  async function handleArchive(fileId: string) {
    setMessage(null);
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати файл");
      return;
    }

    loadFiles();
    if (showArchived) {
      loadFiles(true);
    }
  }

  async function handleRestore(fileId: string) {
    setMessage(null);
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити файл");
      return;
    }

    loadFiles();
    loadFiles(true);
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
      <h3 className="text-lg font-semibold">Файли проєкту</h3>
      <p className="mt-2 text-sm text-stone-600">
        Документи, таблиці, результати, прикріплені до колаборації.
      </p>
      <div className="mt-4 space-y-3">
        {files.length === 0 ? (
          <p className="text-sm text-stone-600">Поки немає файлів.</p>
        ) : (
          files.map((file) => (
            <div
              key={file._id}
              className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4"
            >
              <p className="text-sm font-semibold text-stone-900">{file.name}</p>
              <p className="text-xs text-stone-500">{file.mimeType ?? ""}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(file._id)}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700"
                >
                  Завантажити
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleArchive(file._id)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                  >
                    Архівувати
                  </button>
                ) : null}
              </div>
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
                loadFiles(true);
              }
            }}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedFiles.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedFiles.map((file) => (
                  <div
                    key={file._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(file._id)}
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
        <div className="mt-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50">
            Завантажити файл
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full bg-stone-900 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
      {busy ? (
        <p className="mt-3 text-sm text-stone-600">Завантаження…</p>
      ) : null}
      {message ? (
        <p className="mt-1 text-sm text-stone-600">{message}</p>
      ) : null}
    </section>
  );
}
