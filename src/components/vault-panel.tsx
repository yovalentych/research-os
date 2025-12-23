'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RichTextEditor } from './rich-text-editor';
import { FormReveal } from './form-reveal';
import { useAutoFocus } from './use-auto-focus';
import { usePersistentToggle } from './use-persistent-toggle';

type Project = { _id: string; title: string };
type Folder = {
  _id: string;
  name: string;
  color?: string;
  projectId?: string;
  archived?: boolean;
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
  'slate',
  'emerald',
  'amber',
  'sky',
  'violet',
  'rose',
] as const;

const colorClasses: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
};

const colorDots: Record<string, string> = {
  slate: 'bg-slate-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-400',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
};

function cx(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(' ');
}

function formatBytes(value?: number) {
  if (!value || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const rounded = idx === 0 ? `${Math.round(size)}` : `${size.toFixed(1)}`;
  return `${rounded} ${units[idx]}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

type UploadItem = {
  localId: string;
  file: File;
  progress: number; // 0..100
  status: UploadStatus;
  error?: string;
  remoteId?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function VaultPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  const [projectFilter, setProjectFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>(''); // конкретна папка
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'new' | 'old' | 'name'>('new');

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showCreateFolder, setShowCreateFolder] = usePersistentToggle(
    'form:vault:create-folder',
    false
  );

  const [folderForm, setFolderForm] = useState({
    name: '',
    color: 'slate',
    projectId: '',
  });

  // Upload UI state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadProjectId, setUploadProjectId] = useState<string>('');
  const [uploadTagsText, setUploadTagsText] = useState<string>('');
  const [uploadFolderIds, setUploadFolderIds] = useState<string[]>([]);
  const [uploadNotes, setUploadNotes] = useState<string>('');

  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreateFolder, formRef);

  // Per-file save state (metadata edits)
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const saveTimers = useRef<Record<string, number>>({});

  const cleanupTimer = useCallback((fileId: string) => {
    const t = saveTimers.current[fileId];
    if (t) window.clearTimeout(t);
    delete saveTimers.current[fileId];
  }, []);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((t) => window.clearTimeout(t));
      saveTimers.current = {};
    };
  }, []);

  const projectTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p._id, p.title);
    return map;
  }, [projects]);

  const folderById = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const f of folders) map.set(f._id, f);
    return map;
  }, [folders]);

  const loadProjects = useCallback(async () => {
    const response = await fetch('/api/projects?includeArchived=1');
    if (response.ok) setProjects(await response.json());
  }, []);

  const loadFolders = useCallback(async (projectId: string) => {
    const url = `/api/vault/folders${
      projectId ? `?projectId=${projectId}` : ''
    }`;
    const response = await fetch(url);
    if (response.ok) setFolders(await response.json());
  }, []);

  const loadFiles = useCallback(async (projectId: string) => {
    const url = `/api/vault/files${projectId ? `?projectId=${projectId}` : ''}`;
    const response = await fetch(url);
    if (response.ok) setFiles(await response.json());
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setMessage(null);
    setFolderFilter('');
    setUploadFolderIds([]); // логічно очищати мітки папок при зміні проєкту
    loadFolders(projectFilter);
    loadFiles(projectFilter);

    // uploadProjectId: якщо фільтр є — по дефолту він
    if (projectFilter) setUploadProjectId(projectFilter);
  }, [projectFilter, loadFolders, loadFiles]);

  useEffect(() => {
    if (!showCreateFolder) return;
    setFolderForm((prev) => ({
      ...prev,
      projectId: prev.projectId || projectFilter || '',
    }));
  }, [showCreateFolder, projectFilter]);

  // Підібрати дефолтний uploadProjectId коли підвантажили проєкти
  useEffect(() => {
    if (uploadProjectId) return;
    if (projectFilter) {
      setUploadProjectId(projectFilter);
      return;
    }
    if (projects.length > 0) setUploadProjectId(projects[0]._id);
  }, [projects, projectFilter, uploadProjectId]);

  const visibleFolders = useMemo(() => {
    const filtered = folders.filter(
      (f) =>
        !f.archived &&
        (!f.projectId || !projectFilter || f.projectId === projectFilter)
    );
    return filtered.sort((a, b) => {
      const aScope = a.projectId ? 1 : 0;
      const bScope = b.projectId ? 1 : 0;
      if (aScope !== bScope) return aScope - bScope;
      return a.name.localeCompare(b.name, 'uk');
    });
  }, [folders, projectFilter]);

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) {
      for (const id of f.folderIds ?? []) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [files]);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = files.slice();

    if (folderFilter)
      list = list.filter((f) => (f.folderIds ?? []).includes(folderFilter));

    if (q) {
      list = list.filter((f) => {
        const name = f.name.toLowerCase();
        const tags = (f.tags ?? []).join(',').toLowerCase();
        const notes = (f.notes ?? '').toLowerCase();
        const project = (projectTitleById.get(f.projectId) ?? '').toLowerCase();
        return (
          name.includes(q) ||
          tags.includes(q) ||
          notes.includes(q) ||
          project.includes(q)
        );
      });
    }

    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'uk');
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sort === 'new' ? db - da : da - db;
    });

    return list;
  }, [files, folderFilter, query, sort, projectTitleById]);

  const updateFileDraft = useCallback(
    (fileId: string, patch: Partial<FileItem>) => {
      setFiles((prev) =>
        prev.map((f) => (f._id === fileId ? { ...f, ...patch } : f))
      );
    },
    []
  );

  const handleSaveFile = useCallback(
    async (file: FileItem) => {
      setMessage(null);
      cleanupTimer(file._id);
      setSaveState((prev) => ({ ...prev, [file._id]: 'saving' }));

      const response = await fetch(`/api/files/${file._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: file.notes ?? '',
          tags: file.tags ?? [],
          folderIds: file.folderIds ?? [],
        }),
      });

      if (!response.ok) {
        const data = await safeJson(response);
        setSaveState((prev) => ({ ...prev, [file._id]: 'error' }));
        setMessage(data?.error ?? 'Не вдалося зберегти файл');
        saveTimers.current[file._id] = window.setTimeout(() => {
          setSaveState((prev) => ({ ...prev, [file._id]: 'idle' }));
          cleanupTimer(file._id);
        }, 2500);
        return;
      }

      setSaveState((prev) => ({ ...prev, [file._id]: 'saved' }));
      await loadFiles(projectFilter);

      saveTimers.current[file._id] = window.setTimeout(() => {
        setSaveState((prev) => ({ ...prev, [file._id]: 'idle' }));
        cleanupTimer(file._id);
      }, 1200);
    },
    [cleanupTimer, loadFiles, projectFilter]
  );

  const handleDownload = useCallback(async (fileId: string) => {
    setMessage(null);
    const response = await fetch(`/api/files/download?fileId=${fileId}`);
    if (!response.ok) {
      setMessage('Не вдалося отримати посилання');
      return;
    }
    const data = await safeJson(response);
    if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleCreateFolder = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage(null);
      setBusy(true);

      const response = await fetch('/api/vault/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderForm.name.trim(),
          color: folderForm.color,
          projectId: folderForm.projectId || undefined,
        }),
      });

      setBusy(false);

      if (!response.ok) {
        const data = await safeJson(response);
        setMessage(data?.error ?? 'Не вдалося створити папку');
        return;
      }

      setFolderForm((prev) => ({ ...prev, name: '' }));
      await loadFolders(projectFilter);
    },
    [folderForm, loadFolders, projectFilter]
  );

  const handleArchiveFolder = useCallback(
    async (id: string) => {
      setMessage(null);
      const response = await fetch(`/api/vault/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });

      if (!response.ok) {
        const data = await safeJson(response);
        setMessage(data?.error ?? 'Не вдалося архівувати папку');
        return;
      }

      setFolderFilter((prev) => (prev === id ? '' : prev));
      setUploadFolderIds((prev) => prev.filter((x) => x !== id));
      await loadFolders(projectFilter);
    },
    [loadFolders, projectFilter]
  );

  const clearFilters = useCallback(() => {
    setQuery('');
    setFolderFilter('');
    setSort('new');
  }, []);

  // =========================
  // Upload implementation
  // =========================

  const parsedUploadTags = useMemo(() => {
    return uploadTagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }, [uploadTagsText]);

  const pickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const addToUploadQueue = useCallback(
    (fileList: FileList | File[]) => {
      const arr = Array.isArray(fileList) ? fileList : Array.from(fileList);
      if (arr.length === 0) return;

      setMessage(null);

      // Перевірка: має бути projectId
      if (!uploadProjectId) {
        setMessage('Обери проєкт для завантаження файлів.');
        return;
      }

      const newItems: UploadItem[] = arr.map((f) => ({
        localId: uid(),
        file: f,
        progress: 0,
        status: 'queued',
      }));

      setUploads((prev) => [...newItems, ...prev]);
    },
    [uploadProjectId]
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      addToUploadQueue(e.target.files);
      // дозволяє повторно обирати той самий файл
      e.target.value = '';
    },
    [addToUploadQueue]
  );

  const removeUploadItem = useCallback((localId: string) => {
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }, []);

  const clearFinishedUploads = useCallback(() => {
    setUploads((prev) =>
      prev.filter((u) => u.status === 'queued' || u.status === 'uploading')
    );
  }, []);

  const toggleUploadFolder = useCallback((id: string) => {
    setUploadFolderIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }, []);

  const uploadEndpoints = useMemo(
    () => [
      '/api/vault/files/upload',
      '/api/vault/files',
      '/api/files/upload',
      '/api/files',
    ],
    []
  );

  const xhrUpload = useCallback(
    (url: string, formData: FormData, onProgress: (pct: number) => void) => {
      return new Promise<{ ok: boolean; status: number; data: any }>(
        (resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url, true);

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const pct = Math.round((event.loaded / event.total) * 100);
            onProgress(pct);
          };

          xhr.onload = () => {
            let data: any = null;
            try {
              data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch {
              data = xhr.responseText;
            }
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              data,
            });
          };

          xhr.onerror = () =>
            resolve({ ok: false, status: xhr.status || 0, data: null });

          xhr.send(formData);
        }
      );
    },
    []
  );

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      // підготувати multipart
      const form = new FormData();
      // максимально сумісно: і "file", і "files"
      form.append('file', item.file);
      form.append('files', item.file);
      form.append('projectId', uploadProjectId);

      // метадані — як JSON, щоб серверу було простіше
      form.append('tags', JSON.stringify(parsedUploadTags));
      form.append('folderIds', JSON.stringify(uploadFolderIds));
      form.append('notes', uploadNotes || '');

      for (const endpoint of uploadEndpoints) {
        const res = await xhrUpload(endpoint, form, (pct) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.localId === item.localId ? { ...u, progress: pct } : u
            )
          );
        });

        // 404/405 — пробуємо інший endpoint
        if (!res.ok && (res.status === 404 || res.status === 405)) continue;

        if (!res.ok) {
          const err =
            (res.data && (res.data.error || res.data.message)) ||
            `Помилка завантаження (HTTP ${res.status})`;
          throw new Error(err);
        }

        // Очікувані варіанти відповіді:
        // - { file: {...} }
        // - { data: {...} }
        // - {...} (сам файл)
        const created = res.data?.file || res.data?.data || res.data;

        // якщо повернувся масив — беремо перший
        const createdFile = Array.isArray(created) ? created[0] : created;

        // Після успіху: оновити список
        // (ідеально — додати в state одразу, але найнадійніше — reload)
        await loadFiles(projectFilter);

        return { remoteId: createdFile?._id as string | undefined };
      }

      throw new Error(
        'Upload endpoint не знайдено. Перевір бекенд маршрути для завантаження файлів.'
      );
    },
    [
      xhrUpload,
      uploadEndpoints,
      uploadProjectId,
      parsedUploadTags,
      uploadFolderIds,
      uploadNotes,
      loadFiles,
      projectFilter,
    ]
  );

  // простий керований uploader: 2 паралельні завантаження
  const [uploadingNow, setUploadingNow] = useState(false);

  const startUploads = useCallback(async () => {
    setMessage(null);

    if (!uploadProjectId) {
      setMessage('Обери проєкт для завантаження файлів.');
      return;
    }

    setUploadingNow(true);

    const concurrency = 2;

    const runNext = async (): Promise<void> => {
      const next = uploads.find((u) => u.status === 'queued');
      if (!next) return;

      // mark uploading
      setUploads((prev) =>
        prev.map((u) =>
          u.localId === next.localId
            ? { ...u, status: 'uploading', progress: 0 }
            : u
        )
      );

      try {
        const result = await uploadOne(next);
        setUploads((prev) =>
          prev.map((u) =>
            u.localId === next.localId
              ? {
                  ...u,
                  status: 'done',
                  progress: 100,
                  remoteId: result.remoteId,
                }
              : u
          )
        );
      } catch (e: any) {
        setUploads((prev) =>
          prev.map((u) =>
            u.localId === next.localId
              ? {
                  ...u,
                  status: 'error',
                  error: e?.message ?? 'Помилка завантаження',
                }
              : u
          )
        );
      }

      await runNext();
    };

    const workers = new Array(concurrency).fill(0).map(() => runNext());
    await Promise.all(workers);

    setUploadingNow(false);
  }, [uploads, uploadOne, uploadProjectId]);

  const retryFailedUploads = useCallback(() => {
    setUploads((prev) =>
      prev.map((u) =>
        u.status === 'error'
          ? { ...u, status: 'queued', progress: 0, error: undefined }
          : u
      )
    );
  }, []);

  const uploadStats = useMemo(() => {
    const total = uploads.length;
    const queued = uploads.filter((u) => u.status === 'queued').length;
    const uploading = uploads.filter((u) => u.status === 'uploading').length;
    const done = uploads.filter((u) => u.status === 'done').length;
    const error = uploads.filter((u) => u.status === 'error').length;
    const avgProgress =
      uploads.length === 0
        ? 0
        : Math.round(
            uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length
          );
    return { total, queued, uploading, done, error, avgProgress };
  }, [uploads]);

  // Drag & drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        addToUploadQueue(e.dataTransfer.files);
      }
    },
    [addToUploadQueue]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
      {/* Sidebar */}
      <aside className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Бібліотека</h3>
            <p className="mt-1 text-xs text-slate-500">
              Завантаження файлів, теги, нотатки й папки-мітки.
            </p>
          </div>
        </div>

        {/* Project */}
        <div className="mt-4">
          <label className="text-[11px] font-semibold text-slate-600">
            Проєкт
          </label>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Усі проєкти</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="mt-3">
          <label className="text-[11px] font-semibold text-slate-600">
            Пошук
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Назва, тег, нотатка, проєкт…"
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {/* Folders */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Папки-мітки
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Клік — фільтр. Загальні й проєктні.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateFolder((prev) => !prev)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {showCreateFolder ? 'Закрити' : 'Додати'}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setFolderFilter('')}
              className={cx(
                'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs transition',
                folderFilter
                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'border-slate-300 bg-slate-100 text-slate-900'
              )}
            >
              <span className="font-semibold">Усі файли</span>
              <span className="text-[11px] text-slate-500">{files.length}</span>
            </button>

            {visibleFolders.length === 0 ? (
              <p className="text-xs text-slate-500">Поки немає папок.</p>
            ) : (
              visibleFolders.map((folder) => {
                const active = folderFilter === folder._id;
                const count = folderCounts.get(folder._id) ?? 0;
                return (
                  <div
                    key={folder._id}
                    className={cx(
                      'flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 transition',
                      active
                        ? 'border-slate-300 bg-white'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setFolderFilter(folder._id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={folder.name}
                    >
                      <span
                        className={cx(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]',
                          colorClasses[folder.color ?? 'slate'] ??
                            colorClasses.slate
                        )}
                      >
                        <span
                          className={cx(
                            'mr-2 inline-block h-2 w-2 rounded-full',
                            colorDots[folder.color ?? 'slate'] ?? 'bg-slate-400'
                          )}
                        />
                        <span className="truncate">{folder.name}</span>
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleArchiveFolder(folder._id)}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Архів
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <FormReveal open={showCreateFolder}>
            <form
              ref={formRef}
              className="mt-4 space-y-3"
              onSubmit={handleCreateFolder}
            >
              <div>
                <label className="text-[11px] font-semibold text-slate-600">
                  Назва
                </label>
                <input
                  value={folderForm.name}
                  onChange={(event) =>
                    setFolderForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Напр. 'NMR', 'Протоколи', 'Гранти'…"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Прив’язка
                  </label>
                  <select
                    value={folderForm.projectId}
                    onChange={(event) =>
                      setFolderForm((prev) => ({
                        ...prev,
                        projectId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Загальна папка</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Колір
                  </label>
                  <select
                    value={folderForm.color}
                    onChange={(event) =>
                      setFolderForm((prev) => ({
                        ...prev,
                        color: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {folderColors.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {folderColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() =>
                      setFolderForm((prev) => ({ ...prev, color }))
                    }
                    className={cx(
                      'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                      folderForm.color === color
                        ? 'border-slate-400 bg-white text-slate-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <span
                      className={cx('h-2 w-2 rounded-full', colorDots[color])}
                    />
                    {color}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={busy}
                className={cx(
                  'w-full rounded-full px-4 py-2 text-sm font-semibold text-white',
                  busy ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
                )}
              >
                {busy ? 'Створюю…' : 'Додати папку'}
              </button>
            </form>
          </FormReveal>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-slate-700">{message}</p>
        ) : null}
      </aside>

      {/* Main */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Файли</h3>
            <p className="mt-1 text-xs text-slate-500">
              {folderFilter
                ? `Фільтр: ${folderById.get(folderFilter)?.name ?? 'Папка'}`
                : 'Останні та відфільтровані файли.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs"
              title="Сортування"
            >
              <option value="new">Спершу нові</option>
              <option value="old">Спершу старі</option>
              <option value="name">За назвою</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Очистити
            </button>
          </div>
        </div>

        {/* Upload block */}
        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Завантаження файлів
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Перетягни файли сюди або вибери вручну. Можна одразу додати
                теги/папки.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={pickFiles}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Вибрати файли
              </button>
              <button
                type="button"
                onClick={startUploads}
                disabled={
                  uploadingNow ||
                  uploads.filter((u) => u.status === 'queued').length === 0
                }
                className={cx(
                  'rounded-full px-4 py-2 text-xs font-semibold',
                  uploadingNow ||
                    uploads.filter((u) => u.status === 'queued').length === 0
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                )}
              >
                {uploadingNow ? 'Завантажую…' : 'Старт'}
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-3">
              <label className="text-[11px] font-semibold text-slate-600">
                Проєкт для upload
              </label>
              <select
                value={uploadProjectId}
                onChange={(e) => setUploadProjectId(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Обрати…</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <div className="mt-3">
                <label className="text-[11px] font-semibold text-slate-600">
                  Теги для нових файлів
                </label>
                <input
                  value={uploadTagsText}
                  onChange={(e) => setUploadTagsText(e.target.value)}
                  placeholder="через кому: protocol, nmr, draft…"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                {parsedUploadTags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsedUploadTags.slice(0, 10).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <label className="text-[11px] font-semibold text-slate-600">
                  Нотатка (для всіх нових)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Коротко: що це за файли / контекст..."
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  Папки-мітки для нових файлів
                </p>
                <button
                  type="button"
                  onClick={() => setUploadFolderIds([])}
                  className="text-[11px] font-semibold text-slate-600 hover:underline"
                >
                  Очистити
                </button>
              </div>

              {visibleFolders.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Немає доступних папок.
                </p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {visibleFolders.map((folder) => {
                    const checked = uploadFolderIds.includes(folder._id);
                    return (
                      <label
                        key={folder._id}
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUploadFolder(folder._id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span
                          className={cx(
                            'rounded-full border px-2 py-0.5 text-[11px]',
                            colorClasses[folder.color ?? 'slate'] ??
                              colorClasses.slate
                          )}
                        >
                          {folder.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Dropzone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cx(
                  'mt-3 rounded-3xl border-2 border-dashed p-4 transition',
                  isDragging
                    ? 'border-slate-400 bg-slate-50'
                    : 'border-slate-200 bg-white'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {isDragging ? 'Відпусти файли тут' : 'Drag & drop зона'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {uploadStats.total > 0
                      ? `${uploadStats.done} готово · ${uploadStats.error} помилок · ${uploadStats.avgProgress}%`
                      : 'Підтримує кілька файлів'}
                  </p>
                </div>

                {/* Hidden input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={onFileInputChange}
                  className="hidden"
                />

                {uploads.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={retryFailedUploads}
                        disabled={
                          uploads.filter((u) => u.status === 'error').length ===
                          0
                        }
                        className={cx(
                          'rounded-full border px-3 py-1 text-[11px] font-semibold',
                          uploads.filter((u) => u.status === 'error').length ===
                            0
                            ? 'border-slate-200 text-slate-400'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        Повторити помилки
                      </button>
                      <button
                        type="button"
                        onClick={clearFinishedUploads}
                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Прибрати завершені
                      </button>
                    </div>

                    {uploads.slice(0, 8).map((u) => (
                      <div
                        key={u.localId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {u.file.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {formatBytes(u.file.size)} ·{' '}
                              {u.status === 'queued'
                                ? 'в черзі'
                                : u.status === 'uploading'
                                ? 'завантаження…'
                                : u.status === 'done'
                                ? 'готово'
                                : 'помилка'}
                              {u.error ? ` · ${u.error}` : ''}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeUploadItem(u.localId)}
                            disabled={u.status === 'uploading'}
                            className={cx(
                              'text-[11px] font-semibold',
                              u.status === 'uploading'
                                ? 'text-slate-300'
                                : 'text-slate-600 hover:underline'
                            )}
                          >
                            Прибрати
                          </button>
                        </div>

                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
                          <div
                            className={cx(
                              'h-full transition-all',
                              u.status === 'error'
                                ? 'bg-rose-400'
                                : u.status === 'done'
                                ? 'bg-emerald-400'
                                : 'bg-slate-400'
                            )}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, u.progress)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    {uploads.length > 8 ? (
                      <p className="text-[11px] text-slate-500">
                        Показано 8 із {uploads.length}. Решта — нижче в черзі.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Порада: обери проєкт (зліва), додай теги/папки, потім
                    перетягни файли.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick folder chips */}
        {visibleFolders.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleFolders.slice(0, 10).map((folder) => {
              const active = folderFilter === folder._id;
              return (
                <button
                  key={folder._id}
                  type="button"
                  onClick={() => setFolderFilter(active ? '' : folder._id)}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                    active
                      ? 'border-slate-400 bg-white text-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <span
                    className={cx(
                      'h-2 w-2 rounded-full',
                      colorDots[folder.color ?? 'slate'] ?? 'bg-slate-400'
                    )}
                  />
                  {folder.name}
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {folderCounts.get(folder._id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Files list */}
        <div className="mt-5 space-y-3">
          {filteredFiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">
                Нічого не знайдено
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Спробуй змінити пошук, проєкт або папку-мітку.
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const projectTitle =
                projectTitleById.get(file.projectId) ?? 'Проєкт';
              const state = saveState[file._id] ?? 'idle';

              const fileFolders = (file.folderIds ?? [])
                .map((id) => folderById.get(id))
                .filter(Boolean) as Folder[];

              return (
                <article
                  key={file._id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {file.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                          {projectTitle}
                        </span>
                        <span>·</span>
                        <span>
                          {file.createdAt
                            ? new Date(file.createdAt).toLocaleDateString(
                                'uk-UA'
                              )
                            : '—'}
                        </span>
                        <span>·</span>
                        <span>{formatBytes(file.size)}</span>
                        {file.mimeType ? (
                          <>
                            <span>·</span>
                            <span className="truncate">{file.mimeType}</span>
                          </>
                        ) : null}
                      </div>

                      {fileFolders.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {fileFolders.slice(0, 8).map((folder) => (
                            <button
                              key={folder._id}
                              type="button"
                              onClick={() => setFolderFilter(folder._id)}
                              className={cx(
                                'rounded-full border px-2 py-0.5 text-[11px] transition hover:opacity-90',
                                colorClasses[folder.color ?? 'slate'] ??
                                  colorClasses.slate
                              )}
                              title="Фільтрувати за цією папкою"
                            >
                              {folder.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(file._id)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Завантажити
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveFile(file)}
                        className={cx(
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          state === 'saving'
                            ? 'border-slate-200 bg-slate-100 text-slate-500'
                            : state === 'saved'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : state === 'error'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        {state === 'saving'
                          ? 'Зберігаю…'
                          : state === 'saved'
                          ? 'Збережено'
                          : state === 'error'
                          ? 'Повторити'
                          : 'Зберегти'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-700">
                          Нотатка
                        </p>
                        <span className="text-[11px] text-slate-500">
                          Підтримує форматування
                        </span>
                      </div>
                      <RichTextEditor
                        value={file.notes ?? ''}
                        onChange={(value) =>
                          updateFileDraft(file._id, { notes: value })
                        }
                        className="mt-2"
                        placeholder="Додай короткий зміст / контекст / посилання на експеримент…"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-700">
                          Теги
                        </p>
                        <input
                          value={(file.tags ?? []).join(', ')}
                          onChange={(event) =>
                            updateFileDraft(file._id, {
                              tags: event.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="через кому: protocol, nmr, draft…"
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        {(file.tags ?? []).length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(file.tags ?? []).slice(0, 10).map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-700">
                          Папки-мітки
                        </p>

                        {visibleFolders.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Немає доступних папок.
                          </p>
                        ) : (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {visibleFolders.map((folder) => {
                              const checked =
                                file.folderIds?.includes(folder._id) ?? false;
                              return (
                                <label
                                  key={folder._id}
                                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const next = new Set(
                                        file.folderIds ?? []
                                      );
                                      if (event.target.checked)
                                        next.add(folder._id);
                                      else next.delete(folder._id);
                                      updateFileDraft(file._id, {
                                        folderIds: Array.from(next),
                                      });
                                    }}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  <span
                                    className={cx(
                                      'rounded-full border px-2 py-0.5 text-[11px]',
                                      colorClasses[folder.color ?? 'slate'] ??
                                        colorClasses.slate
                                    )}
                                  >
                                    {folder.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
