"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextEditor } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";
import { MilestonesTree } from "./milestones-tree";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Flag,
  FlaskConical,
  FolderKanban,
  Layers,
  Star,
  Target,
} from "lucide-react";

type Milestone = {
  _id: string;
  title: string;
  status?: string;
  dueDate?: string;
  achievements?: string;
  plan?: string;
  projectId?: string | null;
  parentId?: string | null;
  linkedExperimentIds?: string[];
  linkedFileIds?: string[];
  includeInGlobal?: boolean;
  icon?: string;
  color?: string;
  order?: number;
};

type Project = {
  _id: string;
  title: string;
};

type Experiment = {
  _id: string;
  title: string;
  status?: string;
};

type FileItem = {
  _id: string;
  name: string;
};

type FieldVersion = {
  _id: string;
  fieldPath: string;
  newValue?: unknown;
  changedAt?: string;
};

const statusOptions = [
  { value: "planned", label: "Заплановано" },
  { value: "active", label: "Активно" },
  { value: "done", label: "Завершено" },
  { value: "blocked", label: "Заблоковано" },
];

const iconOptions = [
  { value: "Flag", label: "Віха", Icon: Flag },
  { value: "Target", label: "Ціль", Icon: Target },
  { value: "CheckCircle2", label: "Готово", Icon: CheckCircle2 },
  { value: "FlaskConical", label: "Експеримент", Icon: FlaskConical },
  { value: "FileText", label: "Текст", Icon: FileText },
  { value: "Calendar", label: "Календар", Icon: Calendar },
  { value: "FolderKanban", label: "Проєкт", Icon: FolderKanban },
  { value: "Layers", label: "Етап", Icon: Layers },
  { value: "Star", label: "Ключовий", Icon: Star },
];

const colorOptions = [
  { value: "slate", label: "Slate" },
  { value: "emerald", label: "Emerald" },
  { value: "amber", label: "Amber" },
  { value: "sky", label: "Sky" },
  { value: "violet", label: "Violet" },
  { value: "rose", label: "Rose" },
];

const colorDots: Record<string, string> = {
  slate: "bg-slate-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

const emptyCreateForm = {
  title: "",
  status: "planned",
  dueDate: "",
  projectId: "",
  parentId: "",
  includeInGlobal: false,
  icon: "Flag",
  color: "slate",
  order: "",
};

export function MilestonesPanel() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [archivedMilestones, setArchivedMilestones] = useState<Milestone[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectExperiments, setProjectExperiments] = useState<
    Record<string, Experiment[]>
  >({});
  const [projectFiles, setProjectFiles] = useState<Record<string, FileItem[]>>({});
  const [versions, setVersions] = useState<Record<string, FieldVersion[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "global" | "project">("all");
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Milestone | null>(null);
  const [createForm, setCreateForm] = useState({ ...emptyCreateForm });
  const [showCreate, setShowCreate] = usePersistentToggle(
    "form:milestones:create",
    false
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    descendantCount: number;
    title: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  const projectsMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((project) => {
      map[project._id] = project.title;
    });
    return map;
  }, [projects]);

  async function loadMilestones(archived = false) {
    const response = await fetch(
      `/api/milestones${archived ? "?archived=1" : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archived) {
        setArchivedMilestones(data);
      } else {
        setMilestones(data);
      }
    }
  }

  async function loadProjects() {
    const response = await fetch("/api/projects");
    if (response.ok) {
      const data = await response.json();
      setProjects(data);
      if (data.length && !activeProjectId) {
        setActiveProjectId(data[0]._id);
      }
    }
  }

  useEffect(() => {
    loadMilestones();
    loadProjects();
  }, []);

  useEffect(() => {
    const projectIds = Array.from(
      new Set(
        milestones
          .map((milestone) => milestone.projectId)
          .filter((id): id is string => Boolean(id))
      )
    );

    projectIds.forEach((projectId) => {
      if (!projectExperiments[projectId]) {
        fetch(`/api/experiments?projectId=${projectId}`)
          .then((response) => (response.ok ? response.json() : []))
          .then((data) =>
            setProjectExperiments((prev) => ({ ...prev, [projectId]: data }))
          )
          .catch(() => undefined);
      }

      if (!projectFiles[projectId]) {
        fetch(`/api/files?projectId=${projectId}`)
          .then((response) => (response.ok ? response.json() : []))
          .then((data) =>
            setProjectFiles((prev) => ({ ...prev, [projectId]: data }))
          )
          .catch(() => undefined);
      }
    });
  }, [milestones, projectExperiments, projectFiles]);

  useEffect(() => {
    if (!selectedId) {
      setEditor(null);
      return;
    }

    const current = milestones.find((item) => item._id === selectedId);
    if (!current) {
      setEditor(null);
      return;
    }

    setEditor({
      ...current,
      projectId: current.projectId ?? "",
      parentId: current.parentId ?? "",
      includeInGlobal: current.includeInGlobal ?? false,
      icon: current.icon ?? "Flag",
      color: current.color ?? "slate",
    });
  }, [selectedId, milestones]);

  const visibleMilestones = useMemo(() => {
    if (viewMode === "all") {
      return milestones;
    }

    if (viewMode === "project") {
      return milestones.filter((item) => item.projectId === activeProjectId);
    }

    return milestones.filter(
      (item) => !item.projectId || item.includeInGlobal
    );
  }, [milestones, viewMode, activeProjectId]);

  const childrenById = useMemo(() => {
    const map = new Map<string, string[]>();
    visibleMilestones.forEach((milestone) => {
      const parentKey = milestone.parentId ?? "root";
      const list = map.get(parentKey) ?? [];
      list.push(milestone._id);
      map.set(parentKey, list);
    });
    return map;
  }, [visibleMilestones]);

  const parentOptions = useMemo(() => {
    return visibleMilestones.map((item) => ({
      value: item._id,
      label: item.title,
    }));
  }, [visibleMilestones]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      title: createForm.title,
      status: createForm.status,
      dueDate: createForm.dueDate || undefined,
      projectId: createForm.projectId || undefined,
      parentId: createForm.parentId || undefined,
      includeInGlobal: createForm.projectId
        ? createForm.includeInGlobal
        : false,
      icon: createForm.icon,
      color: createForm.color,
      order: createForm.order ? Number(createForm.order) : undefined,
    };

    const response = await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити milestone");
      return;
    }

    setCreateForm({ ...emptyCreateForm, projectId: createForm.projectId });
    loadMilestones();
  }

  async function handleSave() {
    if (!editor) return;
    setMessage(null);

    const payload = {
      title: editor.title,
      status: editor.status,
      dueDate: editor.dueDate || undefined,
      achievements: editor.achievements,
      plan: editor.plan,
      projectId: editor.projectId || null,
      parentId: editor.parentId || null,
      includeInGlobal: editor.projectId ? editor.includeInGlobal : false,
      icon: editor.icon,
      color: editor.color,
      order: editor.order ?? undefined,
      linkedExperimentIds: editor.linkedExperimentIds ?? [],
      linkedFileIds: editor.linkedFileIds ?? [],
    };

    const response = await fetch(`/api/milestones/${editor._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити milestone");
      return;
    }

    loadMilestones();
  }

  async function handleCreateTemplate() {
    setMessage(null);

    const rootResponse = await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Докторська дисертація",
        status: "active",
        icon: "Star",
        color: "violet",
        order: 0,
      }),
    });

    if (!rootResponse.ok) {
      const data = await rootResponse.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити шаблон");
      return;
    }

    const root = await rootResponse.json();
    const children = [
      { title: "Вступ", order: 1, icon: "FileText", color: "slate" },
      { title: "Огляд літератури", order: 2, icon: "FileText", color: "slate" },
      { title: "Методи", order: 3, icon: "FlaskConical", color: "sky" },
      { title: "Результати", order: 4, icon: "Target", color: "emerald" },
      { title: "Обговорення", order: 5, icon: "Layers", color: "amber" },
      { title: "Публікації", order: 6, icon: "FolderKanban", color: "violet" },
      { title: "Захист", order: 7, icon: "Flag", color: "rose" },
    ];

    await Promise.all(
      children.map((child) =>
        fetch("/api/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: child.title,
            status: "planned",
            parentId: root._id,
            includeInGlobal: true,
            icon: child.icon,
            color: child.color,
            order: child.order,
          }),
        })
      )
    );

    loadMilestones();
    setMessage("Шаблон дисертації створено");
  }

  async function handleArchive(id: string) {
    setMessage(null);
    const response = await fetch(`/api/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати milestone");
      return;
    }

    if (selectedId === id) {
      setSelectedId(null);
    }

    loadMilestones();
    if (showArchived) {
      loadMilestones(true);
    }
  }

  function promptDelete(targetId: string, title: string) {
    setDeleteTarget({
      id: targetId,
      descendantCount: countDescendants(targetId),
      title,
    });
  }

  async function handleDelete(id: string, cascade: boolean) {
    setMessage(null);
    const params = new URLSearchParams();
    params.set("cascade", cascade ? "1" : "0");
    if (!cascade) {
      params.set("reparent", "1");
    }

    const response = await fetch(`/api/milestones/${id}?${params}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося видалити milestone");
      setDeleteTarget(null);
      return;
    }

    setDeleteTarget(null);
    if (selectedId === id) {
      setSelectedId(null);
    }
    if (editor?._id === id) {
      setEditor(null);
    }
    loadMilestones();
    if (showArchived) {
      loadMilestones(true);
    }
    setMessage(cascade ? "Гілка видалена" : "Елемент видалено");
  }

  async function handleRestore(id: string) {
    setMessage(null);
    const response = await fetch(`/api/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити milestone");
      return;
    }

    loadMilestones();
    loadMilestones(true);
  }

  async function handleLoadVersions(id: string) {
    if (versions[id]) {
      setVersions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    const response = await fetch(`/api/milestones/${id}/versions`);
    if (response.ok) {
      const data = await response.json();
      setVersions((prev) => ({ ...prev, [id]: data }));
    }
  }

  function toggleLinkedId(
    field: "linkedExperimentIds" | "linkedFileIds",
    id: string
  ) {
    setEditor((prev) => {
      if (!prev) return prev;
      const current = new Set(prev[field] ?? []);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      return { ...prev, [field]: Array.from(current) };
    });
  }

  function countDescendants(rootId: string) {
    let count = 0;
    const stack = [...(childrenById.get(rootId) ?? [])];
    while (stack.length) {
      const current = stack.pop()!;
      count += 1;
      const children = childrenById.get(current) ?? [];
      stack.push(...children);
    }
    return count;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Milestones</h3>
            <p className="mt-1 text-xs text-slate-500">
              Ієрархія віх, етапів та дерева досліджень.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateTemplate}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Шаблон дисертації
            </button>
            <select
              value={viewMode}
              onChange={(event) =>
                setViewMode(event.target.value as "all" | "global" | "project")
              }
              className="rounded-full border border-slate-200 px-3 py-1 text-xs"
            >
              <option value="global">Загальна робота</option>
              <option value="project">Проєкт</option>
              <option value="all">Усе</option>
            </select>
            {viewMode === "project" ? (
              <select
                value={activeProjectId}
                onChange={(event) => setActiveProjectId(event.target.value)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
              >
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {visibleMilestones.length === 0 ? (
            <p className="text-sm text-slate-600">
              Поки немає етапів. Додай перший.
            </p>
          ) : (
            <MilestonesTree
              milestones={visibleMilestones}
              projectsMap={projectsMap}
              onSelect={(id) => setSelectedId(id)}
              onCreateChild={(milestone) => {
                setCreateForm({
                  ...emptyCreateForm,
                  projectId: milestone.projectId ?? "",
                  parentId: milestone._id,
                  includeInGlobal: milestone.includeInGlobal ?? false,
                  order: "",
                });
                setShowCreate(true);
              }}
              onReload={async () => {
                await loadMilestones();
                if (showArchived) {
                  await loadMilestones(true);
                }
              }}
              message={(text) => setMessage(text)}
            />
          )}
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Новий етап
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Додай віха, етап або підетап у дерево.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
            >
              {showCreate ? "Закрити" : "Додати"}
            </button>
          </div>
          <FormReveal open={showCreate}>
            <form ref={formRef} className="mt-4 grid gap-6" onSubmit={handleCreate}>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Основне
                </p>
                <label className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Назва етапу
                  <input
                    required
                    value={createForm.title}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Напр. Підготовка експерименту"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Планування
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Статус
                      <select
                        value={createForm.status}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            status: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {statusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Дедлайн
                      <div className="relative mt-2">
                        <input
                          type="date"
                          value={createForm.dueDate}
                          onChange={(event) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              dueDate: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm"
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Якщо пусто — дедлайн не задано.
                      </span>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Порядок
                      <input
                        type="number"
                        value={createForm.order}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            order: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Для ручного сортування у межах батька.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Контекст
                  </p>
                  <div className="mt-3 grid gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Проєкт
                      <select
                        value={createForm.projectId}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            projectId: event.target.value,
                            includeInGlobal: event.target.value
                              ? prev.includeInGlobal
                              : false,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Загальна віха</option>
                        {projects.map((project) => (
                          <option key={project._id} value={project._id}>
                            {project.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Батьківський етап
                      <select
                        value={createForm.parentId}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            parentId: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Без батьківського етапу</option>
                        {parentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {createForm.projectId ? (
                      <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={createForm.includeInGlobal}
                          onChange={(event) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              includeInGlobal: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Показувати у загальному дереві дисертації
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Вигляд
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Іконка
                    <select
                      value={createForm.icon}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          icon: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {iconOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Колір
                    <select
                      value={createForm.color}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          color: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {colorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setCreateForm((prev) => ({ ...prev, color: option.value }))
                      }
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        createForm.color === option.value
                          ? "border-slate-400 text-slate-800"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          colorDots[option.value] ?? "bg-slate-400"
                        }`}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Додати етап
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Скасувати
                </button>
              </div>
            </form>
          </FormReveal>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              const next = !showArchived;
              setShowArchived(next);
              if (next) {
                loadMilestones(true);
              }
            }}
            className="text-xs font-semibold text-slate-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedMilestones.length === 0 ? (
                <p className="text-xs text-slate-500">Архів порожній.</p>
              ) : (
                archivedMilestones.map((milestone) => (
                  <div
                    key={milestone._id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{milestone.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(milestone._id)}
                        className="text-xs font-semibold text-slate-600"
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Редактор</h3>
        {editor ? (
          <div className="mt-4 space-y-4">
            <input
              value={editor.title}
              onChange={(event) =>
                setEditor((prev) =>
                  prev ? { ...prev, title: event.target.value } : prev
                )
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={editor.status ?? "planned"}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, status: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={editor.dueDate?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, dueDate: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={editor.projectId ?? ""}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, projectId: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Загальна віха</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.title}
                  </option>
                ))}
              </select>
              <select
                value={editor.parentId ?? ""}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, parentId: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Без батьківського етапу</option>
                {parentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {editor.projectId ? (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={editor.includeInGlobal ?? false}
                  onChange={(event) =>
                    setEditor((prev) =>
                      prev
                        ? { ...prev, includeInGlobal: event.target.checked }
                        : prev
                    )
                  }
                />
                Показувати у загальному дереві дисертації
              </label>
            ) : null}
            <div className="grid gap-2 md:grid-cols-3">
              <select
                value={editor.icon ?? "Flag"}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, icon: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {iconOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={editor.color ?? "slate"}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, color: event.target.value } : prev
                  )
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {colorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={editor.order ?? ""}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev
                      ? {
                          ...prev,
                          order: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        }
                      : prev
                  )
                }
                placeholder="Порядок"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setEditor((prev) =>
                      prev ? { ...prev, color: option.value } : prev
                    )
                  }
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    (editor.color ?? "slate") === option.value
                      ? "border-slate-400 text-slate-800"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      colorDots[option.value] ?? "bg-slate-400"
                    }`}
                  />
                  {option.label}
                </button>
              ))}
            </div>
            <RichTextEditor
              value={editor.plan ?? ""}
              onChange={(value) =>
                setEditor((prev) => (prev ? { ...prev, plan: value } : prev))
              }
              placeholder="План"
            />
            <RichTextEditor
              value={editor.achievements ?? ""}
              onChange={(value) =>
                setEditor((prev) =>
                  prev ? { ...prev, achievements: value } : prev
                )
              }
              placeholder="Здобутки"
            />
            {editor.projectId ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Експерименти
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-600">
                    {projectExperiments[editor.projectId]?.length ? (
                      projectExperiments[editor.projectId].map((experiment) => (
                        <label
                          key={experiment._id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={
                              editor.linkedExperimentIds?.includes(
                                experiment._id
                              ) ?? false
                            }
                            onChange={() =>
                              toggleLinkedId("linkedExperimentIds", experiment._id)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>
                            {experiment.title}
                            {experiment.status ? ` (${experiment.status})` : ""}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">
                        Немає експериментів.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Фігури (файли)
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-600">
                    {projectFiles[editor.projectId]?.length ? (
                      projectFiles[editor.projectId].map((file) => (
                        <label
                          key={file._id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={
                              editor.linkedFileIds?.includes(file._id) ?? false
                            }
                            onChange={() =>
                              toggleLinkedId("linkedFileIds", file._id)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>{file.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Немає файлів.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Зберегти
              </button>
              <button
                type="button"
                onClick={() => handleArchive(editor._id)}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
              >
                Архівувати
              </button>
              <button
                type="button"
                onClick={() => promptDelete(editor._id, editor.title)}
                className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600"
              >
                Видалити
              </button>
              <button
                type="button"
                onClick={() => handleLoadVersions(editor._id)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {versions[editor._id] ? "Сховати історію" : "Історія"}
              </button>
              <a
                href={`/api/milestones/${editor._id}/export?format=docx`}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                DOCX
              </a>
              <a
                href={`/api/milestones/${editor._id}/export?format=pdf`}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                PDF
              </a>
            </div>
            {versions[editor._id] ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {versions[editor._id].length === 0 ? (
                  <p>Історія порожня.</p>
                ) : (
                  versions[editor._id].map((version) => (
                    <div key={version._id} className="mt-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {version.changedAt
                          ? new Date(version.changedAt).toLocaleString("uk-UA")
                          : "—"}
                      </p>
                      <p className="text-slate-600">
                        {version.fieldPath}: {JSON.stringify(version.newValue ?? "—")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Обери етап у дереві, щоб редагувати його.
          </p>
        )}
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">
              Видалити &quot;{deleteTarget.title}&quot;?
            </h4>
            <p className="mt-2 text-sm text-slate-600">
              {deleteTarget.descendantCount > 0
                ? `Цей елемент має ${deleteTarget.descendantCount} дочірніх елементів.`
                : "Цей елемент не має дочірніх елементів."}
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => handleDelete(deleteTarget.id, false)}
                className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Видалити тільки цей
              </button>
              {deleteTarget.descendantCount > 0 ? (
                <button
                  type="button"
                  onClick={() => handleDelete(deleteTarget.id, true)}
                  className="w-full rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Видалити гілку (усі підетапи)
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
