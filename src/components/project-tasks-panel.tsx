"use client";

import { useEffect, useRef, useState } from "react";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type Task = {
  _id: string;
  title: string;
  status?: string;
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  notes?: string;
};

const taskStatuses = ["todo", "in-progress", "done"];

export function ProjectTasksPanel({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [members, setMembers] = useState<{ userId: string; name: string }[]>([]);
  const [form, setForm] = useState({
    title: "",
    status: "todo",
    dueDate: "",
    assigneeId: "",
    assigneeName: "",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = usePersistentToggle(
    `form:project-tasks:create:${projectId}`,
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  const templates = [
    { label: "Чекліст", html: "<ul><li></li></ul>" },
    { label: "Результат", html: "<h3>Результат</h3><p></p>" },
  ];

  async function loadTasks(archived = false) {
    const response = await fetch(
      `/api/projects/${projectId}/tasks${archived ? "?archived=1" : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archived) {
        setArchivedTasks(data);
      } else {
        setTasks(data);
      }
    }
  }

  async function loadMembers() {
    const response = await fetch(`/api/projects/${projectId}/members`);
    if (response.ok) {
      const data = await response.json();
      setMembers(
        data
          .map(
            (entry: {
              userId: string;
              user?: { fullName?: string; email?: string };
            }) => ({
              userId: entry.userId,
              name: entry.user?.fullName ?? entry.user?.email ?? "Учасник",
            })
          )
          .filter((entry: { userId: string }) => entry.userId)
      );
    }
  }

  useEffect(() => {
    loadTasks();
    loadMembers();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      title: form.title,
      status: form.status,
      dueDate: form.dueDate || undefined,
      assigneeId: form.assigneeId || undefined,
      assigneeName: form.assigneeName || undefined,
      notes: form.notes,
    };

    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося створити задачу");
      return;
    }

    setForm({
      title: "",
      status: "todo",
      dueDate: "",
      assigneeId: "",
      assigneeName: "",
      notes: "",
    });
    loadTasks();
  }

  async function handleUpdate(task: Task) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/tasks/${task._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося оновити задачу");
      return;
    }

    loadTasks();
  }

  async function handleArchive(taskId: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося архівувати задачу");
      return;
    }

    loadTasks();
    if (showArchived) {
      loadTasks(true);
    }
  }

  async function handleRestore(taskId: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося відновити задачу");
      return;
    }

    loadTasks();
    loadTasks(true);
  }

  return (
    <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
      <h3 className="text-lg font-semibold">Завдання</h3>
      <p className="mt-2 text-sm text-stone-600">
        Розподіл робіт у колаборації та контроль дедлайнів.
      </p>
      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-stone-600">
            Поки немає задач. Додай першу.
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task._id}
              className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4"
            >
              {canEdit ? (
                <input
                  value={task.title}
                  onChange={(event) =>
                    setTasks((prev) =>
                      prev.map((entry) =>
                        entry._id === task._id
                          ? { ...entry, title: event.target.value }
                          : entry
                      )
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"
                />
              ) : (
                <p className="text-sm font-semibold text-stone-900">
                  {task.title}
                </p>
              )}
              {canEdit ? (
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select
                    value={task.status ?? "todo"}
                    onChange={(event) =>
                      setTasks((prev) =>
                        prev.map((entry) =>
                          entry._id === task._id
                            ? { ...entry, status: event.target.value }
                            : entry
                        )
                      )
                    }
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {taskStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={task.dueDate?.slice(0, 10) ?? ""}
                    onChange={(event) =>
                      setTasks((prev) =>
                        prev.map((entry) =>
                          entry._id === task._id
                            ? { ...entry, dueDate: event.target.value }
                            : entry
                        )
                      )
                    }
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={task.assigneeId ?? ""}
                    onChange={(event) => {
                      const selected = members.find(
                        (member) => member.userId === event.target.value
                      );
                      setTasks((prev) =>
                        prev.map((entry) =>
                          entry._id === task._id
                            ? {
                                ...entry,
                                assigneeId: event.target.value,
                                assigneeName: selected?.name ?? "",
                              }
                            : entry
                        )
                      );
                    }}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Без виконавця</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {canEdit ? (
                <RichTextEditor
                  value={task.notes ?? ""}
                  onChange={(value) =>
                    setTasks((prev) =>
                      prev.map((entry) =>
                        entry._id === task._id ? { ...entry, notes: value } : entry
                      )
                    )
                  }
                  className="mt-2"
                  placeholder="Нотатки"
                  templates={templates}
                  uploadContext={{ projectId }}
                />
              ) : task.assigneeName ? (
                <p className="mt-2 text-sm text-stone-600">
                  Виконавець: {task.assigneeName}
                </p>
              ) : task.notes ? (
                <RichTextViewer value={task.notes} className="mt-2" />
              ) : null}
              {canEdit ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(task)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700"
                  >
                    Зберегти
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(task._id)}
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
                loadTasks(true);
              }
            }}
            className="text-xs font-semibold text-stone-500"
          >
            {showArchived ? "Сховати архів" : "Показати архів"}
          </button>
          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedTasks.length === 0 ? (
                <p className="text-xs text-stone-500">Архів порожній.</p>
              ) : (
                archivedTasks.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{task.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(task._id)}
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
            {showCreate ? "Закрити" : "Додати задачу"}
          </button>
          <FormReveal open={showCreate}>
            <form ref={formRef} className="space-y-3" onSubmit={handleCreate}>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Назва задачі"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                required
              />
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                >
                  {taskStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, dueDate: event.target.value }))
                  }
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                />
                <select
                  value={form.assigneeId}
                  onChange={(event) => {
                    const selected = members.find(
                      (member) => member.userId === event.target.value
                    );
                    setForm((prev) => ({
                      ...prev,
                      assigneeId: event.target.value,
                      assigneeName: selected?.name ?? "",
                    }));
                  }}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">Без виконавця</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <RichTextEditor
                value={form.notes}
                onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                placeholder="Нотатки"
                templates={templates}
                uploadContext={{ projectId }}
              />
              <button
                type="submit"
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
              >
                Додати задачу
              </button>
            </form>
          </FormReveal>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
    </section>
  );
}
