"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type UserInfo = {
  _id: string;
  email: string;
  fullName: string;
  globalRole: string;
  createdAt?: string;
};

const roles = ["Owner", "Supervisor", "Mentor", "Collaborator", "Viewer"];

export function UsersPanel({ users }: { users: UserInfo[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [items, setItems] = useState<UserInfo[]>(users);
  const [editing, setEditing] = useState<UserInfo | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    globalRole: "Collaborator",
    password: "",
  });
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    globalRole: "Collaborator",
  });
  const [showCreate, setShowCreate] = usePersistentToggle(
    "form:users:create",
    false
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useAutoFocus(showCreate, formRef);

  useEffect(() => {
    setItems(users);
  }, [users]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const supervisors = items.filter((user) => user.globalRole === "Supervisor");
  const mentors = items.filter((user) => user.globalRole === "Mentor");
  const generalUsers = items.filter(
    (user) => user.globalRole !== "Supervisor" && user.globalRole !== "Mentor"
  );

  function handleOpenEdit(user: UserInfo) {
    setEditing(user);
    setEditForm({
      fullName: user.fullName ?? "",
      globalRole: user.globalRole ?? "Collaborator",
      password: "",
    });
    setModalMessage(null);
  }

  function handleCloseEdit() {
    setEditing(null);
    setModalMessage(null);
  }

  useEffect(() => {
    if (!editing) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseEdit();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editing]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(data.error ?? "Помилка при створенні користувача");
      return;
    }

    const created = await response.json();
    setStatus("ok");
    setMessage("Користувача створено");
    setForm({ email: "", fullName: "", password: "", globalRole: "Collaborator" });
    setItems((prev) => [created, ...prev]);
    router.refresh();
  }

  async function handleUpdate() {
    if (!editing) return;
    setModalMessage(null);
    const payload: Record<string, string> = {};
    if (editForm.fullName && editForm.fullName !== editing.fullName) {
      payload.fullName = editForm.fullName;
    }
    if (editForm.globalRole !== editing.globalRole) {
      payload.globalRole = editForm.globalRole;
    }
    if (editForm.password) {
      payload.password = editForm.password;
    }

    if (Object.keys(payload).length === 0) {
      setModalMessage("Немає змін для збереження");
      return;
    }

    const response = await fetch(`/api/users/${editing._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setModalMessage(data.error ?? "Помилка при оновленні користувача");
      return;
    }

    const updated = await response.json();
    setItems((prev) =>
      prev.map((user) => (user._id === editing._id ? updated : user))
    );
    router.refresh();
    handleCloseEdit();
  }

  async function handleDelete(userId: string) {
    setModalMessage(null);
    const response = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setModalMessage(data.error ?? "Не вдалося видалити користувача");
      return;
    }

    setItems((prev) => prev.filter((user) => user._id !== userId));
    router.refresh();
    handleCloseEdit();
  }

  function handleAssignRole(role: string) {
    setForm((prev) => ({ ...prev, globalRole: role }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const renderUserCard = (user: UserInfo, highlightLabel?: string) => {
    const accent =
      highlightLabel === "Науковий керівник"
        ? "border-amber-200 bg-amber-50/60"
        : highlightLabel === "Ментор"
          ? "border-sky-200 bg-sky-50/60"
          : "border-stone-200/60 bg-white";
    const badge =
      highlightLabel === "Науковий керівник"
        ? "border-amber-200 bg-amber-100 text-amber-700"
        : highlightLabel === "Ментор"
          ? "border-sky-200 bg-sky-100 text-sky-700"
          : "";
    return (
      <div
        key={user._id}
        className={`rounded-2xl border p-4 shadow-sm ${accent}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {highlightLabel ? (
              <span
                className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${badge}`}
              >
                {highlightLabel}
              </span>
            ) : null}
            <p className="mt-2 text-base font-semibold text-stone-900">
              {user.fullName}
            </p>
            <p className="text-xs text-stone-500">{user.email}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-stone-400">
              {user.globalRole}
            </p>
          </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(user)}
            className="rounded-full border border-stone-200 p-2 text-stone-700"
            title="Редагувати"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Видалити користувача?")) return;
              handleDelete(user._id);
            }}
            className="rounded-full border border-rose-200 p-2 text-rose-600"
            title="Видалити"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Ключові ролі</h3>
            <p className="mt-1 text-sm text-stone-600">
              Науковий керівник та ментор виділені окремо.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {supervisors.length > 0
            ? supervisors.map((user) => renderUserCard(user, "Науковий керівник"))
            : (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-stone-800">
                  Науковий керівник
                </p>
                <p className="mt-1 text-xs text-stone-500">Не призначено</p>
                <button
                  type="button"
                  onClick={() => handleAssignRole("Supervisor")}
                  className="mt-3 rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600"
                >
                  Призначити
                </button>
              </div>
            )}
          {mentors.length > 0
            ? mentors.map((user) => renderUserCard(user, "Ментор"))
            : (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-stone-800">Ментор</p>
                <p className="mt-1 text-xs text-stone-500">Не призначено</p>
                <button
                  type="button"
                  onClick={() => handleAssignRole("Mentor")}
                  className="mt-3 rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600"
                >
                  Призначити
                </button>
              </div>
            )}
        </div>

        <div className="mt-8">
          <h4 className="text-lg font-semibold">Усі користувачі</h4>
          {generalUsers.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">
              Немає інших користувачів.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {generalUsers.map((user) => renderUserCard(user))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Додати користувача</h3>
            <p className="mt-2 text-sm text-stone-600">
              Власник керує усіма доступами. Пароль буде встановлено одразу.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700"
          >
            {showCreate ? "Закрити" : "Додати користувача"}
          </button>
        </div>
        <FormReveal open={showCreate}>
          <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-stone-700">
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Повне імʼя
              <input
                required
                value={form.fullName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Пароль
              <input
                required
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Роль
              <select
                value={form.globalRole}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, globalRole: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 disabled:opacity-70"
            >
              Додати користувача
            </button>
            {message ? (
              <p
                className={`text-sm ${
                  status === "error" ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {message}
              </p>
            ) : null}
          </form>
        </FormReveal>
      </section>

      {editing && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                onClick={handleCloseEdit}
              />
              <div className="relative w-full max-w-lg rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_30px_80px_rgba(75,58,36,0.24)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                      Редагування користувача
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-stone-900">
                      {editing.fullName}
                    </h3>
                    <p className="text-xs text-stone-500">{editing.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="text-xs font-semibold text-stone-500"
                  >
                    Закрити
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-stone-700">
                    Імʼя
                    <input
                      value={editForm.fullName}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          fullName: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm font-medium text-stone-700">
                    Роль
                    <select
                      value={editForm.globalRole}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          globalRole: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-stone-700">
                    Новий пароль
                    <input
                      type="password"
                      value={editForm.password}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
                    />
                  </label>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleUpdate}
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
                  >
                    Зберегти зміни
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(editing._id)}
                    className="rounded-full border border-rose-200 px-3 py-2 text-rose-600"
                    title="Видалити"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
                {modalMessage ? (
                  <p className="mt-3 text-sm text-rose-600">{modalMessage}</p>
                ) : null}
                <p className="mt-4 text-xs text-stone-400">Esc — закрити</p>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
