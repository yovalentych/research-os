'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RichTextEditor, RichTextViewer } from './rich-text-editor';
import { useAutoFocus } from './use-auto-focus';

type Project = {
  _id: string;
  title: string;
};

type Manuscript = {
  _id: string;
  title: string;
  type: string; // категорія/тип роботи
  status?: string;
  projectId?: string;
  summary?: string;
  targetJournal?: string;
  deadlineAt?: string; // ISO
  archived?: boolean;
  updatedAt?: string; // якщо є
  createdAt?: string; // якщо є
};

type Section = {
  _id: string;
  sectionType: string;
  content?: string;
  linkedExperimentIds?: string[];
  linkedFileIds?: string[];
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

type SectionVersion = {
  _id: string;
  content?: string;
  linkedExperimentIds?: string[];
  linkedFileIds?: string[];
  changedAt?: string;
};

type SectionBlueprint = {
  id: string;
  name: string;
  include: boolean;
};

const DEFAULT_CATEGORIES = [
  'Кваліфікаційна робота',
  'Наукова стаття',
  'Тези',
  'Звіт / грант',
];

const blueprintPresets: Record<string, string[]> = {
  'Наукова стаття': [
    'Вступ',
    'Методи',
    'Результати',
    'Обговорення',
    'Висновки',
  ],
  'Кваліфікаційна робота': [
    'Вступ',
    'Літературний огляд',
    'Методи',
    'Результати',
    'Обговорення',
    'Висновки',
  ],
  'Звіт / грант': [
    'Контекст',
    'Методи',
    'Результати',
    'Впровадження',
    'Бенефіціари',
  ],
  Тези: ['Контекст', 'Мета', 'Методи', 'Результати', 'Висновки'],
};

const manuscriptStatusOptions = [
  { value: 'draft', label: 'Чернетка' },
  { value: 'writing', label: 'У роботі' },
  { value: 'submitted', label: 'Подано' },
  { value: 'published', label: 'Опубліковано' },
];

const statusLabelMap = new Map(
  manuscriptStatusOptions.map((s) => [s.value, s.label])
);

function formatDateUA(dateISO?: string) {
  if (!dateISO) return '—';
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('uk-UA');
}

function safeTrim(s: string) {
  return (s ?? '').trim();
}

function buildBlueprint(type: string): SectionBlueprint[] {
  const base =
    blueprintPresets[type] ?? blueprintPresets['Наукова стаття'] ?? [];
  return base.map((name, index) => ({
    id: `${type}-${name}-${index}-${Math.random().toString(36).slice(2)}`,
    name,
    include: true,
  }));
}

function useLocalStorageStringArray(key: string, initial: string[]) {
  const [value, setValue] = useState<string[]>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed;
      }
      return initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function sortManuscripts(a: Manuscript, b: Manuscript) {
  // 1) дедлайн: ближчий вище (порожні - нижче)
  const ad = a.deadlineAt
    ? new Date(a.deadlineAt).getTime()
    : Number.POSITIVE_INFINITY;
  const bd = b.deadlineAt
    ? new Date(b.deadlineAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;

  // 2) updatedAt/createdAt (новіші вище)
  const au = a.updatedAt
    ? new Date(a.updatedAt).getTime()
    : a.createdAt
    ? new Date(a.createdAt).getTime()
    : 0;
  const bu = b.updatedAt
    ? new Date(b.updatedAt).getTime()
    : b.createdAt
    ? new Date(b.createdAt).getTime()
    : 0;
  if (au !== bu) return bu - au;

  // 3) назва
  return (a.title ?? '').localeCompare(b.title ?? '', 'uk');
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
      {children}
    </span>
  );
}

function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'neutral' | 'danger';
  }
) {
  const { className, tone = 'neutral', ...rest } = props;
  return (
    <button
      {...rest}
      className={clsx(
        'rounded-full border px-3 py-1 text-xs font-semibold transition',
        tone === 'danger'
          ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
          : 'border-slate-200 text-slate-700 hover:bg-slate-50',
        rest.disabled && 'opacity-50 pointer-events-none',
        className
      )}
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={clsx(
        'rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none',
        className
      )}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={clsx(
        'rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none',
        className
      )}
    />
  );
}

type EditorMode = null | { kind: 'create' } | { kind: 'edit'; id: string };

export function ManuscriptsPanel() {
  // data
  const [projects, setProjects] = useState<Project[]>([]);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [archivedManuscripts, setArchivedManuscripts] = useState<Manuscript[]>(
    []
  );
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState<Manuscript | null>(null);
  const [sectionVersions, setSectionVersions] = useState<
    Record<string, SectionVersion[]>
  >({});

  // ui state
  const [message, setMessage] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  // categories (custom)
  const [customCategories, setCustomCategories] = useLocalStorageStringArray(
    'manuscripts:customCategories',
    []
  );
  const [newCategory, setNewCategory] = useState('');

  const categories = useMemo(() => {
    const merged = [...DEFAULT_CATEGORIES, ...customCategories]
      .map((x) => safeTrim(x))
      .filter(Boolean);
    // dedupe
    const seen = new Set<string>();
    return merged.filter((c) => {
      const key = c.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customCategories]);

  // editor overlay
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const editorFormRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(Boolean(editorMode), editorFormRef);

  // create/edit form state
  const [wizardStep, setWizardStep] = useState(1);
  const [sectionBlueprint, setSectionBlueprint] = useState<SectionBlueprint[]>(
    () => buildBlueprint(DEFAULT_CATEGORIES[1])
  ); // Наукова стаття
  const [customSectionName, setCustomSectionName] = useState('');
  const [form, setForm] = useState({
    title: '',
    type: DEFAULT_CATEGORIES[1],
    projectId: '',
    status: manuscriptStatusOptions[0].value,
    summary: '',
    targetJournal: '',
    deadlineAt: '',
  });
  const previousTypeRef = useRef(form.type);

  const templates = useMemo(
    () => [
      { label: 'Вступ', html: '<h2>Вступ</h2><p></p>' },
      { label: 'Методи', html: '<h2>Методи</h2><p></p>' },
      { label: 'Результати', html: '<h2>Результати</h2><p></p>' },
      { label: 'Обговорення', html: '<h2>Обговорення</h2><p></p>' },
      { label: 'Висновки', html: '<h2>Висновки</h2><p></p>' },
    ],
    []
  );

  // --- API loaders ---
  async function loadProjects() {
    const response = await fetch('/api/projects');
    if (!response.ok) return;
    const data = await response.json();
    setProjects(Array.isArray(data) ? data : []);
  }

  async function loadManuscripts(archived = false) {
    setLoadingList(true);
    try {
      const response = await fetch(
        `/api/manuscripts${archived ? '?archived=1' : ''}`
      );
      if (!response.ok) return;
      const data = await response.json();
      if (archived) setArchivedManuscripts(Array.isArray(data) ? data : []);
      else setManuscripts(Array.isArray(data) ? data : []);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetails(id: string) {
    const response = await fetch(`/api/manuscripts/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    setSelected(data.manuscript);
    setSections(data.sections ?? []);
    setSectionVersions({});
  }

  async function loadProjectData(projectId: string) {
    const [experimentsResponse, filesResponse] = await Promise.all([
      fetch(`/api/experiments?projectId=${projectId}`),
      fetch(`/api/files?projectId=${projectId}`),
    ]);

    if (experimentsResponse.ok)
      setExperiments(await experimentsResponse.json());
    else setExperiments([]);

    if (filesResponse.ok) setFiles(await filesResponse.json());
    else setFiles([]);
  }

  // init
  useEffect(() => {
    loadProjects();
    loadManuscripts(false);
  }, []);

  useEffect(() => {
    if (showArchived) loadManuscripts(true);
  }, [showArchived]);

  useEffect(() => {
    if (!selected?.projectId) {
      setExperiments([]);
      setFiles([]);
      return;
    }
    loadProjectData(selected.projectId);
  }, [selected?.projectId]);

  // blueprint resets on type
  useEffect(() => {
    if (previousTypeRef.current !== form.type) {
      setSectionBlueprint(buildBlueprint(form.type));
      previousTypeRef.current = form.type;
    }
  }, [form.type]);

  // --- category actions ---
  function addCategory() {
    const name = safeTrim(newCategory);
    if (!name) return;

    const lower = name.toLowerCase();
    const exists = [...DEFAULT_CATEGORIES, ...customCategories].some(
      (c) => c.toLowerCase() === lower
    );
    if (exists) {
      setNewCategory('');
      setActiveCategory(name);
      return;
    }
    setCustomCategories((prev) => [...prev, name]);
    setNewCategory('');
    setActiveCategory(name);
  }

  function removeCategory(name: string) {
    setCustomCategories((prev) =>
      prev.filter((c) => c.toLowerCase() !== name.toLowerCase())
    );
    if (activeCategory.toLowerCase() === name.toLowerCase())
      setActiveCategory('__all__');
  }

  // --- list filtering/grouping ---
  const visibleList = useMemo(() => {
    const base = showArchived ? archivedManuscripts : manuscripts;
    const q = safeTrim(search).toLowerCase();

    return base
      .filter((m) => {
        if (activeCategory !== '__all__') {
          if ((m.type ?? '').toLowerCase() !== activeCategory.toLowerCase())
            return false;
        }
        if (q) {
          const hay = `${m.title ?? ''} ${m.type ?? ''} ${
            m.targetJournal ?? ''
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice()
      .sort(sortManuscripts);
  }, [showArchived, archivedManuscripts, manuscripts, activeCategory, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Manuscript[]>();
    for (const m of visibleList) {
      const key = safeTrim(m.type) || 'Без категорії';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }

    // ordering: known categories first in their order, then the rest A-Z
    const knownOrder = new Map<string, number>();
    categories.forEach((c, idx) => knownOrder.set(c.toLowerCase(), idx));

    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      const ai = knownOrder.has(a.toLowerCase())
        ? knownOrder.get(a.toLowerCase())!
        : 10_000;
      const bi = knownOrder.has(b.toLowerCase())
        ? knownOrder.get(b.toLowerCase())!
        : 10_000;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b, 'uk');
    });

    return entries;
  }, [visibleList, categories]);

  // --- open editor ---
  async function openCreate() {
    setMessage(null);
    setWizardStep(1);
    setSections([]);
    setSelected(null);
    setSectionVersions({});
    setExperiments([]);
    setFiles([]);

    setForm((prev) => ({
      ...prev,
      title: '',
      summary: '',
      targetJournal: '',
      deadlineAt: '',
      projectId: prev.projectId ?? '',
      type: prev.type || DEFAULT_CATEGORIES[1],
      status: prev.status || manuscriptStatusOptions[0].value,
    }));

    setSectionBlueprint(buildBlueprint(form.type || DEFAULT_CATEGORIES[1]));
    setCustomSectionName('');
    setEditorMode({ kind: 'create' });
  }

  async function openEdit(id: string) {
    setMessage(null);
    await loadDetails(id);
    setEditorMode({ kind: 'edit', id });
  }

  function closeEditor() {
    setEditorMode(null);
    setMessage(null);
    setSectionVersions({});
  }

  // --- create manuscript ---
  async function createManuscript() {
    setMessage(null);

    const filteredBlueprint = sectionBlueprint.filter((s) => s.include);
    const resolvedBlueprint =
      filteredBlueprint.length > 0
        ? filteredBlueprint
        : buildBlueprint(form.type);

    const payloadSections = resolvedBlueprint.map((s, index) => ({
      sectionType: safeTrim(s.name),
      order: index,
    }));

    const payload: Record<string, unknown> = {
      title: safeTrim(form.title),
      type: form.type,
      status: form.status,
      summary: form.summary,
      targetJournal: form.targetJournal,
      deadlineAt: form.deadlineAt,
      sections: payloadSections,
    };
    if (form.projectId) payload.projectId = form.projectId;

    const response = await fetch('/api/manuscripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? 'Не вдалося створити роботу');
      return null;
    }

    const created: Manuscript = await response.json();
    setMessage('Створено');
    await loadManuscripts(false);
    return created;
  }

  // --- sections save/generate/archive/restore/versions ---
  async function handleSaveSections() {
    if (!selected) return;
    setMessage(null);

    const response = await fetch(`/api/manuscripts/${selected._id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? 'Не вдалося зберегти секції');
      return;
    }

    setMessage('Секції збережено');
    // освіжимо деталі (якщо бекенд змінює updatedAt / версії тощо)
    await loadDetails(selected._id);
    await loadManuscripts(false);
    if (showArchived) await loadManuscripts(true);
  }

  async function handleGenerate() {
    if (!selected) return;
    setMessage(null);

    const response = await fetch(`/api/manuscripts/${selected._id}/generate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? 'Не вдалося згенерувати чернетку');
      return;
    }

    setMessage('Чернетку оновлено');
    await loadDetails(selected._id);
  }

  async function handleArchive(id: string) {
    setMessage(null);
    const response = await fetch(`/api/manuscripts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? 'Не вдалося архівувати');
      return;
    }

    if (selected?._id === id) {
      setSelected(null);
      setSections([]);
      setEditorMode(null);
    }
    await loadManuscripts(false);
    if (showArchived) await loadManuscripts(true);
  }

  async function handleRestore(id: string) {
    setMessage(null);
    const response = await fetch(`/api/manuscripts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? 'Не вдалося відновити');
      return;
    }

    await loadManuscripts(false);
    await loadManuscripts(true);
  }

  async function handleLoadVersions(sectionId: string) {
    if (sectionVersions[sectionId]) {
      setSectionVersions((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      return;
    }

    const response = await fetch(
      `/api/manuscripts/sections/${sectionId}/versions`
    );
    if (!response.ok) return;

    const data = await response.json();
    setSectionVersions((prev) => ({
      ...prev,
      [sectionId]: Array.isArray(data) ? data : [],
    }));
  }

  function toggleLinkedId(
    sectionId: string,
    field: 'linkedExperimentIds' | 'linkedFileIds',
    id: string
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section._id !== sectionId) return section;
        const current = new Set(section[field] ?? []);
        if (current.has(id)) current.delete(id);
        else current.add(id);
        return { ...section, [field]: Array.from(current) };
      })
    );
  }

  // --- blueprint editing helpers ---
  function updateSectionName(id: string, name: string) {
    setSectionBlueprint((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  }
  function toggleSectionInclude(id: string) {
    setSectionBlueprint((prev) =>
      prev.map((s) => (s.id === id ? { ...s, include: !s.include } : s))
    );
  }
  function moveSection(index: number, delta: number) {
    setSectionBlueprint((prev) => {
      const next = [...prev];
      const newIndex = index + delta;
      if (newIndex < 0 || newIndex >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  }
  function removeSection(index: number) {
    setSectionBlueprint((prev) => prev.filter((_, idx) => idx !== index));
  }
  function addCustomSection() {
    const name = safeTrim(customSectionName);
    if (!name) return;
    setSectionBlueprint((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        include: true,
      },
    ]);
    setCustomSectionName('');
  }

  // --- submit create wizard ---
  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (wizardStep === 1) {
      setWizardStep(2);
      return;
    }

    const created = await createManuscript();
    if (!created?._id) return;

    // одразу відкриваємо повноекранний редактор створеної роботи
    await loadDetails(created._id);
    setEditorMode({ kind: 'edit', id: created._id });
    setWizardStep(1);
  }

  // --- UI ---
  return (
    <div className="relative">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Роботи (манускрипти)
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Групування по категоріях · Пошук · Архів · Повноекранне редагування
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук…"
              className="w-[260px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <SecondaryButton
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            title="Показати/сховати архів"
          >
            {showArchived ? 'Архів: ON' : 'Архів: OFF'}
          </SecondaryButton>

          <PrimaryButton type="button" onClick={openCreate}>
            + Додати
          </PrimaryButton>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        {/* SIDEBAR */}
        <aside className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="sm:hidden">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук…"
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* categories */}
          <div className={clsx('mt-4', 'space-y-3')}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Категорії
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('__all__')}
                className={clsx(
                  'text-xs font-semibold',
                  activeCategory === '__all__'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Скинути
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory('__all__')}
                className={clsx(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition',
                  activeCategory === '__all__'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                Усі
              </button>

              {categories.map((c) => {
                const active = activeCategory.toLowerCase() === c.toLowerCase();
                const isCustom = !DEFAULT_CATEGORIES.some(
                  (d) => d.toLowerCase() === c.toLowerCase()
                );
                return (
                  <div key={c} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(c)}
                      className={clsx(
                        'rounded-full border px-3 py-1 text-xs font-semibold transition',
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {c}
                    </button>
                    {isCustom ? (
                      <button
                        type="button"
                        onClick={() => removeCategory(c)}
                        className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                        title="Видалити категорію"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                Додати категорію
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Напр. Review / Препринт / Постер"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
                <IconButton
                  type="button"
                  onClick={addCategory}
                  disabled={!safeTrim(newCategory)}
                >
                  Додати
                </IconButton>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Кастомні категорії зберігаються локально у браузері.
              </p>
            </div>
          </div>

          {/* list */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                {showArchived ? 'Архів' : 'Список'}
              </p>
              <span className="text-xs text-slate-500">
                {loadingList ? 'Завантаження…' : `${visibleList.length} шт.`}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Поки порожньо
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Натисни{' '}
                    <span className="font-semibold text-slate-700">
                      “+ Додати”
                    </span>{' '}
                    справа зверху.
                  </p>
                </div>
              ) : (
                grouped.map(([groupName, items]) => {
                  const isCollapsed = Boolean(collapsedGroups[groupName]);
                  return (
                    <div
                      key={groupName}
                      className="rounded-2xl border border-slate-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [groupName]: !prev[groupName],
                          }))
                        }
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {groupName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {items.length} шт.
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {isCollapsed ? 'Розгорнути' : 'Згорнути'}
                        </span>
                      </button>

                      {!isCollapsed ? (
                        <div className="space-y-2 border-t border-slate-100 p-3">
                          {items.map((m) => {
                            const isSelected =
                              selected?._id === m._id &&
                              editorMode?.kind !== 'create';
                            return (
                              <button
                                key={m._id}
                                type="button"
                                onClick={() => openEdit(m._id)}
                                className={clsx(
                                  'flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
                                  isSelected
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={clsx(
                                      'truncate text-sm font-semibold',
                                      isSelected
                                        ? 'text-white'
                                        : 'text-slate-900'
                                    )}
                                  >
                                    {m.title}
                                  </p>
                                  <div
                                    className={clsx(
                                      'mt-1 flex flex-wrap gap-2 text-[11px] font-semibold',
                                      isSelected
                                        ? 'text-white/80'
                                        : 'text-slate-500'
                                    )}
                                  >
                                    <span>
                                      Дедлайн: {formatDateUA(m.deadlineAt)}
                                    </span>
                                    <span>·</span>
                                    <span>
                                      {statusLabelMap.get(
                                        m.status ?? 'draft'
                                      ) ??
                                        m.status ??
                                        'draft'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <Badge>{m.status ?? 'draft'}</Badge>

                                  {!showArchived ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchive(m._id);
                                      }}
                                      className={clsx(
                                        'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                                        isSelected
                                          ? 'border-white/30 text-white hover:bg-white/10'
                                          : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                      )}
                                    >
                                      Архівувати
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestore(m._id);
                                      }}
                                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      Відновити
                                    </button>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT PREVIEW (lightweight) */}
        <main className="rounded-3xl border border-slate-200 bg-white p-6">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Поточна робота
                  </p>
                  <h4 className="mt-2 truncate text-xl font-semibold text-slate-900">
                    {selected.title}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{selected.type}</Badge>
                    <Badge>
                      {statusLabelMap.get(selected.status ?? 'draft') ??
                        selected.status ??
                        'draft'}
                    </Badge>
                    <Badge>Дедлайн: {formatDateUA(selected.deadlineAt)}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={() => openEdit(selected._id)}
                  >
                    Відкрити редактор
                  </SecondaryButton>
                  <PrimaryButton type="button" onClick={openCreate}>
                    + Додати
                  </PrimaryButton>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                    Цільовий журнал
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selected.targetJournal || '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                    Проєкт
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selected.projectId
                      ? projects.find((p) => p._id === selected.projectId)
                          ?.title ?? '—'
                      : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                    Секцій
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {sections.length}
                  </p>
                </div>

                <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    Резюме
                  </p>
                  <div className="mt-2">
                    {selected.summary ? (
                      <RichTextViewer value={selected.summary} />
                    ) : (
                      <p className="text-xs text-slate-500">Опис відсутній.</p>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-6 text-sm text-slate-600">
                Редагування та створення — у повноекранному режимі (кнопка
                “Відкрити редактор”).
              </p>
            </>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <div className="max-w-md">
                <h4 className="text-lg font-semibold text-slate-900">
                  Обери роботу зліва
                </h4>
                <p className="mt-2 text-sm text-slate-600">
                  Або створи нову — кнопка{' '}
                  <span className="font-semibold text-slate-800">
                    “+ Додати”
                  </span>{' '}
                  зверху праворуч.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      ) : null}

      {/* FULLSCREEN OVERLAY: CREATE / EDIT */}
      {editorMode ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeEditor}
          />
          <div className="absolute inset-3 md:inset-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              {/* overlay header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    {editorMode.kind === 'create'
                      ? 'Створення роботи'
                      : 'Редактор'}
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold text-slate-900">
                    {editorMode.kind === 'create'
                      ? form.title
                        ? form.title
                        : 'Нова робота'
                      : selected?.title ?? '—'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {editorMode.kind === 'edit' && selected ? (
                    <>
                      <SecondaryButton
                        type="button"
                        onClick={handleSaveSections}
                      >
                        Зберегти
                      </SecondaryButton>
                      <PrimaryButton type="button" onClick={handleGenerate}>
                        Згенерувати
                      </PrimaryButton>
                      <a
                        href={`/api/manuscripts/${selected._id}/export?format=docx`}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        DOCX
                      </a>
                      <a
                        href={`/api/manuscripts/${selected._id}/export?format=pdf`}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        PDF
                      </a>
                      <IconButton
                        type="button"
                        tone="danger"
                        onClick={() => handleArchive(selected._id)}
                        title="Архівувати"
                      >
                        Архів
                      </IconButton>
                    </>
                  ) : null}

                  <IconButton type="button" onClick={closeEditor}>
                    Закрити
                  </IconButton>
                </div>
              </div>

              {/* overlay body */}
              <div className="h-full overflow-auto">
                {editorMode.kind === 'create' ? (
                  <div className="mx-auto grid w-full max-w-5xl gap-4 px-5 py-6">
                    <form
                      ref={editorFormRef}
                      className="space-y-5"
                      onSubmit={handleCreateSubmit}
                    >
                      {/* wizard header */}
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                            Майстер створення
                          </p>
                          <span className="text-[11px] text-slate-500">
                            Крок {wizardStep} з 2
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                          {[
                            { id: 1, label: 'Інформація' },
                            { id: 2, label: 'Секції' },
                          ].map((step) => (
                            <span
                              key={step.id}
                              className={clsx(
                                'rounded-full border px-3 py-1 transition',
                                wizardStep === step.id
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 text-slate-600'
                              )}
                            >
                              {step.id}. {step.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {wizardStep === 1 ? (
                        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              value={form.title}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  title: e.target.value,
                                }))
                              }
                              placeholder="Назва роботи"
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                              required
                            />
                            <select
                              value={form.type}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, type: e.target.value }))
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            >
                              {categories.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <select
                              value={form.projectId}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  projectId: e.target.value,
                                }))
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            >
                              <option value="">Проєкт (не обовʼязково)</option>
                              {projects.map((project) => (
                                <option key={project._id} value={project._id}>
                                  {project.title}
                                </option>
                              ))}
                            </select>

                            <select
                              value={form.status}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  status: e.target.value,
                                }))
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            >
                              {manuscriptStatusOptions.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>

                            <input
                              type="date"
                              value={form.deadlineAt}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  deadlineAt: e.target.value,
                                }))
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            />
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              value={form.targetJournal}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  targetJournal: e.target.value,
                                }))
                              }
                              placeholder="Цільовий журнал / комітет"
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            />
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              Шаблон секцій підтягнеться з категорії
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                              Стислий опис
                            </p>
                            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-1">
                              <RichTextEditor
                                value={form.summary}
                                onChange={(value) =>
                                  setForm((p) => ({ ...p, summary: value }))
                                }
                                placeholder="Короткий огляд, фокуси, гіпотези"
                                className="min-h-[140px]"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">
                              Налаштуй секції
                            </p>
                            <p className="text-xs text-slate-500">
                              Можна вимкнути зайве, перейменувати, переставити
                            </p>
                          </div>

                          <div className="space-y-3">
                            {sectionBlueprint.map((section, index) => (
                              <div
                                key={section.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <input
                                    value={section.name}
                                    onChange={(e) =>
                                      updateSectionName(
                                        section.id,
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                                  />
                                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={section.include}
                                      onChange={() =>
                                        toggleSectionInclude(section.id)
                                      }
                                      className="h-4 w-4 rounded border-slate-300"
                                    />
                                    Включити
                                  </label>
                                </div>

                                <div className="mt-3 flex gap-2">
                                  <IconButton
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => moveSection(index, -1)}
                                  >
                                    ↑
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    disabled={
                                      index === sectionBlueprint.length - 1
                                    }
                                    onClick={() => moveSection(index, 1)}
                                  >
                                    ↓
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    tone="danger"
                                    onClick={() => removeSection(index)}
                                  >
                                    Видалити
                                  </IconButton>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                              Додати секцію
                            </p>
                            <div className="mt-2 flex gap-2">
                              <input
                                value={customSectionName}
                                onChange={(e) =>
                                  setCustomSectionName(e.target.value)
                                }
                                placeholder="Нова секція"
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                              />
                              <IconButton
                                type="button"
                                onClick={addCustomSection}
                                disabled={!safeTrim(customSectionName)}
                              >
                                Додати
                              </IconButton>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        {wizardStep > 1 ? (
                          <SecondaryButton
                            type="button"
                            onClick={() => setWizardStep(1)}
                          >
                            Назад
                          </SecondaryButton>
                        ) : (
                          <div />
                        )}
                        <PrimaryButton
                          type="submit"
                          disabled={wizardStep === 1 && !safeTrim(form.title)}
                        >
                          {wizardStep === 1 ? 'Наступний крок' : 'Створити'}
                        </PrimaryButton>
                      </div>
                    </form>
                  </div>
                ) : (
                  // EDITOR
                  <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-6">
                    {!selected ? (
                      <p className="text-sm text-slate-600">Завантаження…</p>
                    ) : (
                      <>
                        {/* meta */}
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                              Загальна інформація
                            </p>
                            <div className="mt-2 grid gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge>{selected.type}</Badge>
                                <Badge>
                                  {statusLabelMap.get(
                                    selected.status ?? 'draft'
                                  ) ??
                                    selected.status ??
                                    'draft'}
                                </Badge>
                                <Badge>
                                  Дедлайн: {formatDateUA(selected.deadlineAt)}
                                </Badge>
                              </div>
                              <div className="text-sm text-slate-600">
                                <span className="font-semibold text-slate-800">
                                  Журнал:
                                </span>{' '}
                                {selected.targetJournal || '—'}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                              Резюме
                            </p>
                            <div className="mt-2">
                              {selected.summary ? (
                                <RichTextViewer value={selected.summary} />
                              ) : (
                                <p className="text-xs text-slate-500">
                                  Опис відсутній.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* sections */}
                        <div className="space-y-4">
                          {sections.map((section) => (
                            <div
                              key={section._id}
                              className="rounded-3xl border border-slate-200 bg-white p-5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-base font-semibold text-slate-900">
                                  {section.sectionType}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleLoadVersions(section._id)
                                  }
                                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                >
                                  {sectionVersions[section._id]
                                    ? 'Сховати історію'
                                    : 'Показати історію'}
                                </button>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-1">
                                <RichTextEditor
                                  value={section.content ?? ''}
                                  onChange={(value) =>
                                    setSections((prev) =>
                                      prev.map((entry) =>
                                        entry._id === section._id
                                          ? { ...entry, content: value }
                                          : entry
                                      )
                                    )
                                  }
                                  className="min-h-[220px]"
                                  placeholder="Текст секції"
                                  templates={templates}
                                  uploadContext={
                                    selected.projectId
                                      ? { projectId: selected.projectId }
                                      : undefined
                                  }
                                />
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Експерименти
                                  </p>
                                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                                    {experiments.length === 0 ? (
                                      <p className="text-xs text-slate-500">
                                        Немає експериментів для цього проєкту.
                                      </p>
                                    ) : (
                                      experiments.map((experiment) => (
                                        <label
                                          key={experiment._id}
                                          className="flex items-center gap-2"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={
                                              section.linkedExperimentIds?.includes(
                                                experiment._id
                                              ) ?? false
                                            }
                                            onChange={() =>
                                              toggleLinkedId(
                                                section._id,
                                                'linkedExperimentIds',
                                                experiment._id
                                              )
                                            }
                                            className="h-4 w-4 rounded border-slate-300"
                                          />
                                          <span>
                                            {experiment.title}
                                            {experiment.status
                                              ? ` (${experiment.status})`
                                              : ''}
                                          </span>
                                        </label>
                                      ))
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Фігури (файли)
                                  </p>
                                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                                    {files.length === 0 ? (
                                      <p className="text-xs text-slate-500">
                                        Немає файлів для цього проєкту.
                                      </p>
                                    ) : (
                                      files.map((file) => (
                                        <label
                                          key={file._id}
                                          className="flex items-center gap-2"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={
                                              section.linkedFileIds?.includes(
                                                file._id
                                              ) ?? false
                                            }
                                            onChange={() =>
                                              toggleLinkedId(
                                                section._id,
                                                'linkedFileIds',
                                                file._id
                                              )
                                            }
                                            className="h-4 w-4 rounded border-slate-300"
                                          />
                                          <span className="truncate">
                                            {file.name}
                                          </span>
                                        </label>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>

                              {sectionVersions[section._id] ? (
                                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                                    Історія версій
                                  </p>
                                  <div className="mt-3 space-y-3 text-xs text-slate-600">
                                    {sectionVersions[section._id].length ===
                                    0 ? (
                                      <p>Історія порожня.</p>
                                    ) : (
                                      sectionVersions[section._id].map(
                                        (version) => (
                                          <div
                                            key={version._id}
                                            className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                                          >
                                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                              {version.changedAt
                                                ? new Date(
                                                    version.changedAt
                                                  ).toLocaleString('uk-UA')
                                                : '—'}
                                            </p>
                                            <p className="mt-1 text-slate-700">
                                              {(version.content ?? '').slice(
                                                0,
                                                240
                                              ) || '—'}
                                            </p>
                                          </div>
                                        )
                                      )
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <SecondaryButton
                            type="button"
                            onClick={handleSaveSections}
                          >
                            Зберегти секції
                          </SecondaryButton>
                          <PrimaryButton type="button" onClick={handleGenerate}>
                            Згенерувати чернетку
                          </PrimaryButton>
                          <a
                            href={`/api/manuscripts/${selected._id}/export?format=docx`}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            DOCX
                          </a>
                          <a
                            href={`/api/manuscripts/${selected._id}/export?format=pdf`}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            PDF
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {message ? (
                <div className="border-t border-slate-100 px-5 py-3">
                  <p className="text-sm text-slate-600">{message}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
