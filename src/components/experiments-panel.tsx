"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";
import { RichTextEditor } from "./rich-text-editor";

type Project = {
  _id: string;
  title: string;
};

type Experiment = {
  _id: string;
  projectId: string;
  title: string;
  status?: string;
  protocol?: {
    version?: string;
    checklist?: string[];
    steps?: string[];
  };
  plan?: {
    steps?: string[];
    deadlines?: string[];
    dependencies?: string[];
  };
  results?: {
    metrics?: string[];
    figures?: string[];
    conclusion?: string;
  };
  quality?: {
    issues?: string;
    nextTime?: string;
  };
  links?: {
    papers?: string[];
    tasks?: string[];
    collaborations?: string[];
    materials?: string[];
  };
  updatedAt?: string;
};

type FileItem = {
  _id: string;
  name: string;
  mimeType?: string;
  size?: number;
  updatedAt?: string;
};

type TimelineChange = {
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
};

type TimelineEntry = {
  _id: string;
  action: string;
  timestamp: string;
  actor?: { id: string; name?: string; email?: string } | null;
  changes?: TimelineChange[];
};

type ExperimentEditor = {
  _id: string;
  projectId: string;
  title: string;
  status: string;
  protocolVersion: string;
  protocolChecklist: string;
  protocolSteps: string;
  planSteps: string;
  planDeadlines: string;
  planDependencies: string[];
  resultsMetrics: string;
  resultsFigures: string;
  resultsConclusion: string;
  qualityIssues: string;
  qualityNextTime: string;
  linksPapers: string;
  linksTasks: string;
  linksCollaborations: string;
  linksMaterials: string;
};

const statusOptions = [
  { value: "draft", label: "Чернетка" },
  { value: "planned", label: "Заплановано" },
  { value: "running", label: "В роботі" },
  { value: "done", label: "Завершено" },
  { value: "blocked", label: "Заблоковано" },
];

const protocolTemplates = [
  {
    id: "emsa",
    label: "EMSA",
    version: "EMSA v1",
    checklist: [
      "Підготувати буфери та реактиви",
      "Перевірити концентрації білка/оліго",
      "Підготувати гелі та ланес",
      "Підготувати маркери",
      "Підготувати контрольні умови",
    ],
    steps: [
      "Змішати компоненти реакції та інкубувати",
      "Додати loading buffer",
      "Запустити гель",
      "Фіксація/візуалізація",
      "Зберегти сирі дані",
    ],
  },
  {
    id: "cd",
    label: "CD",
    version: "CD v1",
    checklist: [
      "Перевірити чистоту зразків",
      "Підготувати кювети",
      "Перевірити температуру та калібрування",
      "Задати параметри спектру",
    ],
    steps: [
      "Підготувати серії концентрацій",
      "Записати базову лінію",
      "Зняти спектри для кожного зразка",
      "Зберегти сирі дані",
    ],
  },
  {
    id: "qpcr",
    label: "qPCR",
    version: "qPCR v1",
    checklist: [
      "Перевірити праймери",
      "Підготувати cDNA",
      "Підготувати master mix",
      "Вказати контрольні гени",
    ],
    steps: [
      "Рознести зразки у планшет",
      "Запустити програму ампліфікації",
      "Перевірити melt curves",
      "Зібрати Ct значення",
    ],
  },
];

function listToText(list?: (string | Date)[]) {
  if (!list || list.length === 0) return "";
  return list
    .map((item) => {
      if (item instanceof Date) return item.toISOString().slice(0, 10);
      const asDate = new Date(item);
      if (!Number.isNaN(asDate.getTime())) {
        return asDate.toISOString().slice(0, 10);
      }
      return String(item);
    })
    .join("\n");
}

function textToList(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toEditor(experiment: Experiment): ExperimentEditor {
  return {
    _id: experiment._id,
    projectId: experiment.projectId,
    title: experiment.title,
    status: experiment.status ?? "draft",
    protocolVersion: experiment.protocol?.version ?? "",
    protocolChecklist: listToText(experiment.protocol?.checklist),
    protocolSteps: listToText(experiment.protocol?.steps),
    planSteps: listToText(experiment.plan?.steps),
    planDeadlines: listToText(experiment.plan?.deadlines),
    planDependencies: experiment.plan?.dependencies ?? [],
    resultsMetrics: listToText(experiment.results?.metrics),
    resultsFigures: listToText(experiment.results?.figures),
    resultsConclusion: experiment.results?.conclusion ?? "",
    qualityIssues: experiment.quality?.issues ?? "",
    qualityNextTime: experiment.quality?.nextTime ?? "",
    linksPapers: listToText(experiment.links?.papers),
    linksTasks: listToText(experiment.links?.tasks),
    linksCollaborations: listToText(experiment.links?.collaborations),
    linksMaterials: listToText(experiment.links?.materials),
  };
}

function fromEditor(editor: ExperimentEditor) {
  return {
    title: editor.title,
    status: editor.status,
    protocol: {
      version: editor.protocolVersion.trim() || undefined,
      checklist: textToList(editor.protocolChecklist),
      steps: textToList(editor.protocolSteps),
    },
    plan: {
      steps: textToList(editor.planSteps),
      deadlines: textToList(editor.planDeadlines),
      dependencies: editor.planDependencies,
    },
    results: {
      metrics: textToList(editor.resultsMetrics),
      figures: textToList(editor.resultsFigures),
      conclusion: editor.resultsConclusion,
    },
    quality: {
      issues: editor.qualityIssues,
      nextTime: editor.qualityNextTime,
    },
    links: {
      papers: textToList(editor.linksPapers),
      tasks: textToList(editor.linksTasks),
      collaborations: textToList(editor.linksCollaborations),
      materials: textToList(editor.linksMaterials),
    },
  };
}

export function ExperimentsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [archivedExperiments, setArchivedExperiments] = useState<Experiment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ExperimentEditor | null>(null);
  const [attachments, setAttachments] = useState<FileItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    status: "draft",
  });
  const [showCreate, setShowCreate] = usePersistentToggle(
    "form:experiments:create",
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    if (!response.ok) return;
    const data = await response.json();
    setProjects(data);
    if (!selectedProjectId && data.length) {
      setSelectedProjectId(data[0]._id);
    }
  }

  async function loadExperiments(projectId: string, archived = false) {
    setLoading(true);
    const response = await fetch(
      `/api/experiments?projectId=${projectId}${archived ? "&archived=1" : ""}`
    );
    if (!response.ok) {
      setMessage("Не вдалося завантажити експерименти");
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (archived) {
      setArchivedExperiments(data);
    } else {
      setExperiments(data);
      const stillExists = data.find((item: Experiment) => item._id === selectedId);
      setSelectedId(stillExists?._id ?? data[0]?._id ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setForm((prev) => ({ ...prev, projectId: selectedProjectId }));
    loadExperiments(selectedProjectId);
    if (showArchived) {
      loadExperiments(selectedProjectId, true);
    }
  }, [selectedProjectId, showArchived]);

  useEffect(() => {
    if (!selectedId) {
      setEditor(null);
      setAttachments([]);
      setTimeline([]);
      return;
    }
    const experiment = experiments.find((item) => item._id === selectedId);
    if (experiment) {
      setEditor(toEditor(experiment));
    }
  }, [experiments, selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedProjectId) return;
    fetch(
      `/api/files?projectId=${selectedProjectId}&entityType=Experiment&entityId=${selectedId}`
    )
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setAttachments(data))
      .catch(() => setAttachments([]));
  }, [selectedId, selectedProjectId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingTimeline(true);
    fetch(`/api/experiments/${selectedId}/timeline`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data) => setTimeline(data.items ?? []))
      .finally(() => setLoadingTimeline(false));
  }, [selectedId]);

  const dependencies = useMemo(() => {
    return experiments.filter((item) => item._id !== selectedId);
  }, [experiments, selectedId]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!form.projectId) {
      setMessage("Обери проєкт для експерименту");
      return;
    }
    const response = await fetch("/api/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити експеримент");
      return;
    }
    setForm((prev) => ({ ...prev, title: "" }));
    loadExperiments(form.projectId);
  }

  async function handleSave() {
    if (!editor) return;
    setMessage(null);
    const response = await fetch(`/api/experiments/${editor._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fromEditor(editor)),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося зберегти експеримент");
      return;
    }
    loadExperiments(selectedProjectId);
  }

  async function handleArchive(id: string) {
    setMessage(null);
    const response = await fetch(`/api/experiments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати експеримент");
      return;
    }
    loadExperiments(selectedProjectId);
    if (showArchived) {
      loadExperiments(selectedProjectId, true);
    }
  }

  async function handleRestore(id: string) {
    setMessage(null);
    const response = await fetch(`/api/experiments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити експеримент");
      return;
    }
    loadExperiments(selectedProjectId);
    loadExperiments(selectedProjectId, true);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !editor) return;
    const formData = new FormData();
    formData.append("projectId", editor.projectId);
    formData.append("entityType", "Experiment");
    formData.append("entityId", editor._id);
    formData.append("file", file);
    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      setMessage("Не вдалося завантажити файл");
      return;
    }
    event.target.value = "";
    const updated = await response.json();
    setAttachments((prev) => [updated, ...prev]);
  }

  async function handleFileDownload(fileId: string) {
    const response = await fetch(`/api/files/download?fileId=${fileId}`);
    if (!response.ok) {
      setMessage("Не вдалося згенерувати посилання");
      return;
    }
    const data = await response.json();
    if (data?.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleFileArchive(fileId: string) {
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (!response.ok) {
      setMessage("Не вдалося архівувати файл");
      return;
    }
    setAttachments((prev) => prev.filter((item) => item._id !== fileId));
  }

  function applyProtocolTemplate(templateId: string) {
    if (!editor) return;
    const template = protocolTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            protocolVersion: template.version,
            protocolChecklist: template.checklist.join("\n"),
            protocolSteps: template.steps.join("\n"),
          }
        : prev
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Експерименти</h3>
            <p className="mt-2 text-sm text-stone-600">
              Лабораторний журнал з планом, протоколом та результатами.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="rounded-full border border-stone-200 px-3 py-1 text-xs"
            >
              {projects.length === 0 ? (
                <option value="">Немає проєктів</option>
              ) : (
                projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.title}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600"
            >
              {showCreate ? "Закрити" : "Додати"}
            </button>
          </div>
        </div>

        <FormReveal open={showCreate}>
          <form ref={formRef} className="mt-4 grid gap-4" onSubmit={handleCreate}>
            <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Назва експерименту
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Напр. EMSA для TFO-2"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Статус
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Створити експеримент
              </button>
            </div>
          </form>
        </FormReveal>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-stone-500">Завантаження…</p>
          ) : experiments.length === 0 ? (
            <p className="text-sm text-stone-600">
              Поки немає експериментів. Створи перший.
            </p>
          ) : (
            experiments.map((experiment) => (
              <button
                key={experiment._id}
                type="button"
                onClick={() => setSelectedId(experiment._id)}
                className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  selectedId === experiment._id
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200/60 bg-stone-50/70 text-stone-700 hover:border-stone-300"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {experiment.title}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      selectedId === experiment._id
                        ? "text-white/70"
                        : "text-stone-500"
                    }`}
                  >
                    {statusOptions.find((option) => option.value === experiment.status)
                      ?.label ?? "Чернетка"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    selectedId === experiment._id
                      ? "border-white/20 text-white/80"
                      : "border-stone-200 text-stone-500"
                  }`}
                >
                  {experiment.updatedAt
                    ? new Date(experiment.updatedAt).toLocaleDateString("uk-UA")
                    : "—"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedExperiments.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedExperiments.map((experiment) => (
                  <div
                    key={experiment._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{experiment.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(experiment._id)}
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
        <h3 className="text-lg font-semibold text-stone-900">Редактор</h3>
        {editor ? (
          <div className="mt-4 space-y-6">
            <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
              <input
                value={editor.title}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, title: event.target.value } : prev
                  )
                }
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <select
                value={editor.status}
                onChange={(event) =>
                  setEditor((prev) =>
                    prev ? { ...prev, status: event.target.value } : prev
                  )
                }
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Протокол
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {protocolTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyProtocolTemplate(template.id)}
                    className="rounded-full border border-stone-200 px-3 py-1 text-[11px] font-semibold text-stone-600"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Версія
                  <input
                    value={editor.protocolVersion}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, protocolVersion: event.target.value } : prev
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Чекліст (кожен пункт з нового рядка)
                  <textarea
                    value={editor.protocolChecklist}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev
                          ? { ...prev, protocolChecklist: event.target.value }
                          : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Кроки протоколу
                  <textarea
                    value={editor.protocolSteps}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, protocolSteps: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[120px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                План
              </p>
              <div className="mt-3 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Кроки плану
                  <textarea
                    value={editor.planSteps}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, planSteps: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[100px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Дедлайни (YYYY-MM-DD)
                  <textarea
                    value={editor.planDeadlines}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, planDeadlines: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Залежності
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dependencies.length === 0 ? (
                      <span className="text-xs text-stone-500">
                        Немає інших експериментів у проєкті.
                      </span>
                    ) : (
                      dependencies.map((dependency) => {
                        const active = editor.planDependencies.includes(
                          dependency._id
                        );
                        return (
                          <button
                            key={dependency._id}
                            type="button"
                            onClick={() =>
                              setEditor((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      planDependencies: active
                                        ? prev.planDependencies.filter(
                                            (id) => id !== dependency._id
                                          )
                                        : [...prev.planDependencies, dependency._id],
                                    }
                                  : prev
                              )
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              active
                                ? "border-stone-900 bg-stone-900 text-white"
                                : "border-stone-200 text-stone-600 hover:border-stone-300"
                            }`}
                          >
                            {dependency.title}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Результати
              </p>
              <div className="mt-3 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Метрики
                  <textarea
                    value={editor.resultsMetrics}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, resultsMetrics: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Фігури / графіки
                  <textarea
                    value={editor.resultsFigures}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, resultsFigures: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Висновок
                  <RichTextEditor
                    value={editor.resultsConclusion}
                    onChange={(value) =>
                      setEditor((prev) =>
                        prev ? { ...prev, resultsConclusion: value } : prev
                      )
                    }
                    placeholder="Ключові висновки та інтерпретація"
                    className="mt-2"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Якість
              </p>
              <div className="mt-3 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Що пішло не так
                  <RichTextEditor
                    value={editor.qualityIssues}
                    onChange={(value) =>
                      setEditor((prev) =>
                        prev ? { ...prev, qualityIssues: value } : prev
                      )
                    }
                    placeholder="Опиши проблеми та відхилення"
                    className="mt-2"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Що змінити наступного разу
                  <RichTextEditor
                    value={editor.qualityNextTime}
                    onChange={(value) =>
                      setEditor((prev) =>
                        prev ? { ...prev, qualityNextTime: value } : prev
                      )
                    }
                    placeholder="Нові умови, оптимізації, кроки"
                    className="mt-2"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Посилання
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Публікації
                  <textarea
                    value={editor.linksPapers}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, linksPapers: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Завдання
                  <textarea
                    value={editor.linksTasks}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, linksTasks: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Колаборації
                  <textarea
                    value={editor.linksCollaborations}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev
                          ? { ...prev, linksCollaborations: event.target.value }
                          : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Матеріали
                  <textarea
                    value={editor.linksMaterials}
                    onChange={(event) =>
                      setEditor((prev) =>
                        prev ? { ...prev, linksMaterials: event.target.value } : prev
                      )
                    }
                    className="mt-2 min-h-[80px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Вкладення
                </p>
                <label className="rounded-full border border-stone-200 px-3 py-1 text-[11px] font-semibold text-stone-600">
                  Додати файл
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    Поки немає файлів для цього експерименту.
                  </p>
                ) : (
                  attachments.map((file) => (
                    <div
                      key={file._id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{file.name}</p>
                        <p className="text-[11px] text-stone-400">
                          {file.mimeType ?? "файл"}{" "}
                          {file.size ? `· ${(file.size / 1024).toFixed(1)} KB` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFileDownload(file._id)}
                          className="rounded-full border border-stone-200 px-3 py-1 text-[11px] font-semibold text-stone-600"
                        >
                          Завантажити
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFileArchive(file._id)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600"
                        >
                          Архів
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Історія змін
              </p>
              <div className="mt-3 space-y-3">
                {loadingTimeline ? (
                  <p className="text-xs text-stone-500">Завантаження…</p>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    Поки немає зафіксованих змін.
                  </p>
                ) : (
                  timeline.map((entry) => (
                    <div
                      key={entry._id}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold uppercase">
                          {entry.action}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {new Date(entry.timestamp).toLocaleString("uk-UA")}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500">
                        {entry.actor?.name ?? entry.actor?.email ?? "Система"}
                      </p>
                      {entry.changes && entry.changes.length ? (
                        <div className="mt-2 space-y-1">
                          {entry.changes.map((change, index) => (
                            <p key={`${change.fieldPath}-${index}`} className="text-[11px]">
                              <span className="font-semibold">{change.fieldPath}</span>
                              {": "}
                              <span className="text-stone-400">
                                {String(change.oldValue ?? "—")}
                              </span>
                              {" → "}
                              <span>{String(change.newValue ?? "—")}</span>
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Зберегти зміни
              </button>
              <button
                type="button"
                onClick={() => handleArchive(editor._id)}
                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
              >
                Архівувати
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-600">
            Обери експеримент, щоб заповнювати журнал.
          </p>
        )}

        {message ? <p className="mt-4 text-sm text-stone-600">{message}</p> : null}
      </section>
    </div>
  );
}
