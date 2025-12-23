"use client";

import { useEffect, useRef, useState } from "react";
import { FormReveal } from "./form-reveal";
import { useAutoFocus } from "./use-auto-focus";
import { usePersistentToggle } from "./use-persistent-toggle";

type Member = {
  _id: string;
  userId: string;
  role: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
    globalRole: string;
  } | null;
};

type User = {
  _id: string;
  fullName: string;
  email: string;
  globalRole: string;
};

const memberRoles = ["Collaborator", "Viewer"];

export function ProjectMembersPanel({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("Collaborator");
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = usePersistentToggle(
    `form:project-members:create:${projectId}`,
    false
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(showCreate, formRef);

  async function loadMembers() {
    const response = await fetch(`/api/projects/${projectId}/members`);
    if (response.ok) {
      const data = await response.json();
      setMembers(data);
    }
  }

  async function loadUsers() {
    const response = await fetch("/api/users");
    if (!response.ok) {
      setMessage("Немає доступу до списку користувачів");
      return;
    }

    const data = await response.json();
    setUsers(data);
    if (data.length) {
      setSelectedUser(data[0]._id);
    }
  }

  useEffect(() => {
    loadMembers();
    loadUsers();
  }, []);

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!selectedUser) {
      setMessage("Немає доступних користувачів для додавання");
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser, role: selectedRole }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося додати учасника");
      return;
    }

    setMessage("Учасника додано");
    loadMembers();
  }

  async function handleRemove(userId: string) {
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Не вдалося видалити учасника");
      return;
    }

    setMessage("Учасника видалено");
    loadMembers();
  }

  if (!canManage) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h3 className="text-xl font-semibold">Учасники колаборації</h3>
        <div className="mt-4 space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-stone-600">
              Поки немає учасників. Додай першого.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member._id}
                className="rounded-2xl border border-stone-200/60 bg-stone-50/70 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {member.user?.fullName ?? "Невідомий користувач"}
                </p>
                <p className="text-xs text-stone-500">
                  {member.user?.email ?? ""} · {member.role}
                </p>
                <button
                  type="button"
                  onClick={() => handleRemove(member.userId)}
                  className="mt-3 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                >
                  Видалити
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Додати учасника</h3>
            <p className="mt-2 text-sm text-stone-600">
              Обери користувача і роль у проєкті.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700"
          >
            {showCreate ? "Закрити" : "Додати"}
          </button>
        </div>
        <FormReveal open={showCreate}>
          <form ref={formRef} className="space-y-4" onSubmit={handleAddMember}>
            <label className="block text-sm font-medium text-stone-700">
              Користувач
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              >
                {users.length === 0 ? (
                  <option value="">Немає доступних користувачів</option>
                ) : (
                  users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.fullName} ({user.email})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Роль
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
              >
                {memberRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
            >
              Додати учасника
            </button>
            {message ? (
              <p className="text-sm text-stone-600">{message}</p>
            ) : null}
          </form>
        </FormReveal>
      </section>
    </div>
  );
}
