"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  isOrderedDragTarget,
  keyboardDragAndDropFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { AssistiveTreeDescription, useTree } from "@headless-tree/react";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  Flag,
  FlaskConical,
  FolderKanban,
  Layers,
  Pencil,
  Star,
  Target,
} from "lucide-react";

type Milestone = {
  _id: string;
  title: string;
  status?: string;
  dueDate?: string;
  projectId?: string | null;
  parentId?: string | null;
  includeInGlobal?: boolean;
  icon?: string;
  color?: string;
  order?: number;
};

const statusOptions = [
  { value: "planned", label: "Заплановано" },
  { value: "active", label: "Активно" },
  { value: "done", label: "Завершено" },
  { value: "blocked", label: "Заблоковано" },
];

const iconOptions = [
  { value: "Flag", Icon: Flag },
  { value: "Target", Icon: Target },
  { value: "CheckCircle2", Icon: CheckCircle2 },
  { value: "FlaskConical", Icon: FlaskConical },
  { value: "FileText", Icon: FileText },
  { value: "Calendar", Icon: Calendar },
  { value: "FolderKanban", Icon: FolderKanban },
  { value: "Layers", Icon: Layers },
  { value: "Star", Icon: Star },
] as const;

const iconMap = iconOptions.reduce<Record<string, (typeof iconOptions)[number]["Icon"]>>(
  (acc, item) => {
    acc[item.value] = item.Icon;
    return acc;
  },
  {}
);

const colorClasses: Record<string, string> = {
  slate: "text-slate-600 bg-slate-100 border-slate-200",
  emerald: "text-emerald-700 bg-emerald-100 border-emerald-200",
  amber: "text-amber-700 bg-amber-100 border-amber-200",
  sky: "text-sky-700 bg-sky-100 border-sky-200",
  violet: "text-violet-700 bg-violet-100 border-violet-200",
  rose: "text-rose-700 bg-rose-100 border-rose-200",
};

function getDueBadge(dueDate?: string) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    return {
      label: "Прострочено",
      className: "border-rose-200 bg-rose-100 text-rose-700",
    };
  }

  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) {
    return {
      label: "Сьогодні",
      className: "border-amber-200 bg-amber-100 text-amber-700",
    };
  }
  if (diffDays <= 7) {
    return {
      label: "Цього тижня",
      className: "border-sky-200 bg-sky-100 text-sky-700",
    };
  }

  return null;
}

type TreeItemData =
  | { kind: "root" }
  | { kind: "milestone"; milestone: Milestone };

function sortMilestones(a: Milestone, b: Milestone) {
  const orderA = a.order ?? 0;
  const orderB = b.order ?? 0;
  if (orderA !== orderB) return orderA - orderB;

  const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
  const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
  if (dateA !== dateB) return dateA - dateB;

  return a.title.localeCompare(b.title, "uk-UA");
}

async function patchMilestone(
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  await fetch(`/api/milestones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function MilestonesTree(props: {
  milestones: Milestone[];
  projectsMap: Record<string, string>;
  onSelect: (id: string | null) => void;
  onCreateChild: (milestone: Milestone) => void;
  onReload: () => Promise<void>;
  message?: (text: string) => void;
}) {
  const { milestones, projectsMap, onSelect, onCreateChild, onReload, message } =
    props;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingStatus, setEditingStatus] = useState("planned");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const { itemsById, childrenByParent, parentKeyById } = useMemo(() => {
    const itemsById = new Map<string, Milestone>();
    milestones.forEach((m) => itemsById.set(m._id, m));

    const childrenByParent = new Map<string, string[]>();
    const parentKeyById = new Map<string, string>();

    const getParentKey = (m: Milestone) => {
      const pid = m.parentId ?? null;
      if (pid && itemsById.has(pid)) return pid;
      return "root";
    };

    for (const m of milestones) {
      const pk = getParentKey(m);
      parentKeyById.set(m._id, pk);
      const list = childrenByParent.get(pk) ?? [];
      list.push(m._id);
      childrenByParent.set(pk, list);
    }

    for (const [pk, ids] of childrenByParent.entries()) {
      const sorted = [...ids]
        .map((id) => itemsById.get(id)!)
        .sort(sortMilestones)
        .map((m) => m._id);
      childrenByParent.set(pk, sorted);
    }

    return { itemsById, childrenByParent, parentKeyById };
  }, [milestones]);

  const tree = useTree<TreeItemData>({
    rootItemId: "root",
    indent: 16,
    canReorder: true,
    getItemName: (item) => {
      const data = item.getItemData();
      return data.kind === "milestone" ? data.milestone.title : "Milestones";
    },
    isItemFolder: () => true,
    dataLoader: {
      getItem: (id) => {
        if (id === "root") return { kind: "root" } as TreeItemData;
        const m = itemsById.get(id);
        return { kind: "milestone", milestone: m! } as TreeItemData;
      },
      getChildren: (id) => childrenByParent.get(id) ?? [],
    },
    onPrimaryAction: (item) => {
      const id = item.getId();
      onSelect(id === "root" ? null : id);
    },
    onDrop: async (draggedItems, target) => {
      const movedIds = draggedItems
        .map((item) => item.getId())
        .filter((id) => id !== "root");
      if (!movedIds.length) return;

      const movedSet = new Set(movedIds);
      const targetParentKey = target.item.getId();
      const newParentKey = targetParentKey === "root" ? "root" : targetParentKey;
      const insertAt = isOrderedDragTarget(target)
        ? target.insertionIndex
        : childrenByParent.get(newParentKey)?.length ?? 0;

      const affectedParents = new Set<string>([newParentKey]);
      for (const id of movedIds) {
        const oldPk = parentKeyById.get(id) ?? "root";
        affectedParents.add(oldPk);
      }

      const finalChildrenByParent = new Map<string, string[]>();
      for (const pk of affectedParents) {
        const current = childrenByParent.get(pk) ?? [];
        const withoutMoved = current.filter((id) => !movedSet.has(id));

        if (pk === newParentKey) {
          const next = [...withoutMoved];
          const safeInsert = Math.max(0, Math.min(insertAt, next.length));
          next.splice(safeInsert, 0, ...movedIds);
          finalChildrenByParent.set(pk, next);
        } else {
          finalChildrenByParent.set(pk, withoutMoved);
        }
      }

      try {
        await Promise.all(
          Array.from(finalChildrenByParent.entries()).flatMap(([pk, ids]) =>
            ids.map((id, index) =>
              patchMilestone(id, {
                parentId: pk === "root" ? null : pk,
                order: index,
              })
            )
          )
        );

        await onReload();
        message?.("Переміщено ✅");
      } catch (error) {
        console.error(error);
        message?.("Не вдалося перемістити етап");
      }
    },
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
      keyboardDragAndDropFeature,
    ],
  });

  useEffect(() => {
    tree.scheduleRebuildTree();
  }, [tree, milestones]);

  const selectedId = tree.getState().selectedItems?.[0] ?? null;

  useEffect(() => {
    onSelect(selectedId && selectedId !== "root" ? selectedId : null);
  }, [selectedId, onSelect]);

  async function handleSaveInline(id: string) {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    try {
      await patchMilestone(id, {
        title: trimmed,
        status: editingStatus,
        ...(editingDueDate ? { dueDate: editingDueDate } : {}),
      });
      await onReload();
      message?.("Етап оновлено ✅");
      setEditingId(null);
    } catch (error) {
      console.error(error);
      message?.("Не вдалося зберегти зміни");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div
      {...tree.getContainerProps("Milestones tree")}
      className="relative min-h-[220px] space-y-2"
    >
      <AssistiveTreeDescription tree={tree} />

      {tree
        .getItems()
        .filter((item) => item.getId() !== "root")
        .map((item) => {
          const data = item.getItemData();
          if (data.kind !== "milestone") return null;

          const m = data.milestone;
          const Icon = iconMap[m.icon ?? "Flag"] ?? Flag;
          const isSelected = item.isSelected?.() ? item.isSelected() : false;
          const level = item.getItemMeta().level;
          const hasChildren = item.getChildren().length > 0;
          const isExpanded = item.isExpanded();
          const isDragTarget = item.isDragTarget?.() ?? false;
          const dueBadge = getDueBadge(m.dueDate);

          const colorClass =
            colorClasses[m.color ?? "slate"] ?? colorClasses.slate;

          return (
            <div
              key={item.getKey()}
              className="relative"
              style={{ marginLeft: level * 16 }}
            >
              {level > 0 ? (
                <span className="pointer-events-none absolute left-3 top-0 h-full w-px bg-slate-200" />
              ) : null}
              <div
                {...item.getProps()}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                } ${
                  isDragTarget
                    ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-white"
                    : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!hasChildren) return;
                      if (isExpanded) item.collapse();
                      else item.expand();
                    }}
                    className={`grid h-6 w-6 place-items-center rounded-full border text-slate-500 transition ${
                      hasChildren
                        ? "border-slate-200 hover:border-slate-300"
                        : "border-transparent opacity-40"
                    } ${isSelected ? "border-white/20 text-white/70" : ""}`}
                    aria-label={isExpanded ? "Згорнути" : "Розгорнути"}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition ${
                        hasChildren && isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                      isSelected ? "border-white/20 bg-white/10" : colorClass
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0">
                    {editingId === m._id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSaveInline(m._id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingId(null);
                            }
                          }}
                          className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-sm ${
                            isSelected
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-slate-200 bg-white text-slate-900"
                          }`}
                          autoFocus
                        />
                        <select
                          value={editingStatus}
                          onChange={(event) => setEditingStatus(event.target.value)}
                          className={`h-8 w-32 rounded-lg border px-2 text-xs ${
                            isSelected
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editingDueDate}
                          onChange={(event) => setEditingDueDate(event.target.value)}
                          className={`h-8 w-36 rounded-lg border px-2 text-xs ${
                            isSelected
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        />
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                            isSelected
                              ? "border-white/20 text-white/90"
                              : "border-slate-200 text-slate-500"
                          }`}
                        >
                          {savingEdit ? "..." : "Зберегти"}
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold">{m.title}</p>
                        <p
                          className={`text-xs ${
                            isSelected ? "text-white/70" : "text-slate-500"
                          }`}
                        >
                          {m.projectId
                            ? projectsMap[m.projectId] ?? "Проєкт"
                            : "Загальна віха"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {dueBadge ? (
                    <span
                      title={m.dueDate?.slice(0, 10)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${dueBadge.className}`}
                    >
                      {dueBadge.label}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      isSelected
                        ? "border-white/20 text-white/90"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {statusOptions.find((s) => s.value === (m.status ?? "planned"))
                      ?.label ?? "Заплановано"}
                  </span>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingId(m._id);
                      setEditingTitle(m.title);
                      setEditingStatus(m.status ?? "planned");
                      setEditingDueDate(m.dueDate?.slice(0, 10) ?? "");
                    }}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      isSelected
                        ? "border-white/20 text-white/90"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Pencil className="h-3 w-3" />
                      Редагувати
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreateChild(m);
                    }}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      isSelected
                        ? "border-white/20 text-white/90"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    + Підетап
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      <div
        style={tree.getDragLineStyle()}
        className="pointer-events-none h-0.5 rounded-full bg-sky-500"
      />
    </div>
  );
}
