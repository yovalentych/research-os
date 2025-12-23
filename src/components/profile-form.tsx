"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { transliterateUkrainian } from "@/lib/transliterate";

const degreeLevels = [
  "Бакалавр",
  "Магістр",
  "PhD/Докторант",
  "Постдок",
  "Науковець",
  "Інше",
];

type OrganizationOption = {
  name: string;
  rorId?: string;
  edboId?: string;
  edrpou?: string;
  institutionType?: string;
  regionCode?: string;
  legalName?: string;
  address?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  website?: string;
  types?: string[];
  source?: "edbo" | "ror";
};

type UserProfile = {
  email: string;
  fullName?: string;
  latinFullName?: string;
  firstName?: string;
  lastName?: string;
  latinFirstName?: string;
  latinLastName?: string;
  degreeCompleted?: string;
  degreeInProgress?: string;
  publicProfile?: boolean;
  contactVisibility?: "public" | "email";
  organizationName?: string;
  organization?: OrganizationOption | null;
};

type ProfileFormProps = {
  mode: "onboarding" | "settings";
};

export function ProfileForm({ mode }: ProfileFormProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale ?? "uk";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<OrganizationOption[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const orgTimerRef = useRef<number | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationOption | null>(null);
  const [autoLatin, setAutoLatin] = useState(true);
  const [orgSource, setOrgSource] = useState<"all" | "edbo" | "ror">("all");
  const [orgOpen, setOrgOpen] = useState(false);

  useEffect(() => {
    fetch("/api/users/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setProfile({
          ...data,
          degreeCompleted: data.degreeCompleted ?? degreeLevels[0],
          degreeInProgress: data.degreeInProgress ?? "",
          publicProfile: data.publicProfile ?? true,
          contactVisibility: data.contactVisibility ?? "public",
        });
        setOrgQuery(data.organizationName ?? "");
        if (data.organization) {
          setSelectedOrg(data.organization);
        }
        setStatus("idle");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Не вдалося завантажити профіль");
      });
  }, []);

  const firstName = profile?.firstName ?? "";
  const lastName = profile?.lastName ?? "";

  useEffect(() => {
    if (!firstName || !lastName) return;
    if (!autoLatin) return;
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            latinFirstName: transliterateUkrainian(firstName),
            latinLastName: transliterateUkrainian(lastName),
          }
        : prev
    );
  }, [firstName, lastName, autoLatin]);

  useEffect(() => {
    if (!orgOpen) {
      setOrgResults([]);
      return;
    }
    if (orgTimerRef.current) {
      window.clearTimeout(orgTimerRef.current);
    }
    if (!orgQuery.trim() || orgQuery.trim().length < 3) {
      setOrgResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setOrgLoading(true);
      try {
        const response = await fetch(
          `/api/organizations/search?q=${encodeURIComponent(
            orgQuery.trim()
          )}&source=${orgSource}`
        );
        if (response.ok) {
          const data = await response.json();
          setOrgResults(Array.isArray(data) ? data : []);
        }
      } finally {
        setOrgLoading(false);
      }
    }, 350);
    orgTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [orgQuery, orgSource]);

  async function handleSave() {
    if (!profile) return;
    setStatus("saving");
    setMessage(null);

    const organization = selectedOrg
      ? selectedOrg
      : orgQuery.trim()
        ? { name: orgQuery.trim() }
        : null;

    const response = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        latinFirstName: profile.latinFirstName,
        latinLastName: profile.latinLastName,
        degreeCompleted: profile.degreeCompleted ?? degreeLevels[0],
        degreeInProgress: profile.degreeInProgress ?? "",
        publicProfile: profile.publicProfile ?? true,
        contactVisibility: profile.contactVisibility ?? "public",
        organization,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(data.error ?? "Не вдалося зберегти профіль");
      return;
    }

    const updated = await response.json();
    setProfile(updated);
    setStatus("idle");
    setMessage("Збережено");

    if (mode === "onboarding") {
      router.push(`/${locale}`);
    }
  }

  if (status === "loading" || !profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Завантажуємо профіль...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          {mode === "onboarding" ? "Онбординг" : "Профіль"}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "onboarding" ? "Налаштуй профіль" : "Мій профіль"}
        </h1>
        <p className="text-sm text-slate-600">
          {mode === "onboarding"
            ? "Перевір дані, щоб почати роботу в Research OS."
            : "Оновлюй персональні дані для автозаповнення документів."}
        </p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Ім&apos;я
            <input
              type="text"
              value={profile.firstName ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev ? { ...prev, firstName: event.target.value } : prev
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Прізвище
            <input
              type="text"
              value={profile.lastName ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev ? { ...prev, lastName: event.target.value } : prev
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            First name (Latin)
            <input
              type="text"
              value={profile.latinFirstName ?? ""}
              onChange={(event) => {
                setAutoLatin(false);
                setProfile((prev) =>
                  prev ? { ...prev, latinFirstName: event.target.value } : prev
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Last name (Latin)
            <input
              type="text"
              value={profile.latinLastName ?? ""}
              onChange={(event) => {
                setAutoLatin(false);
                setProfile((prev) =>
                  prev ? { ...prev, latinLastName: event.target.value } : prev
                );
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={profile.email}
              disabled
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Отриманий ступінь
            <select
              value={profile.degreeCompleted ?? degreeLevels[0]}
              onChange={(event) =>
                setProfile((prev) =>
                  prev ? { ...prev, degreeCompleted: event.target.value } : prev
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              {degreeLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            У процесі здобуття (необов&apos;язково)
            <select
              value={profile.degreeInProgress ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev ? { ...prev, degreeInProgress: event.target.value } : prev
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">Не в процесі</option>
              {degreeLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={profile.publicProfile ?? true}
              onChange={(event) =>
                setProfile((prev) =>
                  prev ? { ...prev, publicProfile: event.target.checked } : prev
                )
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Показувати мій профіль у пошуку контактів
          </label>
          {profile.publicProfile ? (
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Доступність у пошуку
              <select
                value={profile.contactVisibility ?? "public"}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          contactVisibility: event.target
                            .value as UserProfile["contactVisibility"],
                        }
                      : prev
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="public">Публічно (ім&apos;я або email)</option>
                <option value="email">Тільки за email</option>
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Організація
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: "all", label: "Обидва" },
                { id: "edbo", label: "ЄДЕБО" },
                { id: "ror", label: "ROR" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOrgSource(item.id as "all" | "edbo" | "ror")}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    orgSource === item.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={orgQuery}
              onChange={(event) => {
                setOrgQuery(event.target.value);
                setSelectedOrg(null);
              }}
              onFocus={() => {
                if (blurTimerRef.current) {
                  window.clearTimeout(blurTimerRef.current);
                }
                setOrgOpen(true);
              }}
              onBlur={() => {
                blurTimerRef.current = window.setTimeout(() => {
                  setOrgOpen(false);
                }, 120);
              }}
              placeholder="Почни вводити назву університету або інституту"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </label>
        </div>
        {orgLoading ? (
          <p className="mt-2 text-xs text-slate-500">Пошук організацій...</p>
        ) : null}
        {orgOpen && orgResults.length > 0 ? (
          <div
            className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white text-sm text-slate-700"
            onMouseDown={(event) => event.preventDefault()}
          >
            {orgResults.map((option, index) => (
              <button
                key={`${option.edboId ?? option.rorId ?? option.name}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedOrg(option);
                  setOrgQuery(option.name);
                  setOrgResults([]);
                  setOrgOpen(false);
                }}
                className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">{option.name}</p>
                  <p className="text-xs text-slate-500">
                    {option.city ? `${option.city}, ` : ""}{option.country ?? ""}
                    {option.edrpou ? ` · ЄДРПОУ ${option.edrpou}` : ""}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  {option.source === "edbo" ? "ЄДЕБО" : option.rorId ? "ROR" : "ORG"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {selectedOrg?.legalName || selectedOrg?.address ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Деталі організації</p>
            {selectedOrg.legalName ? (
              <p className="mt-1">
                Юридична назва:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedOrg.legalName}
                </span>
              </p>
            ) : null}
            {selectedOrg.address ? (
              <p className="mt-1">
                Адреса:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedOrg.address}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
        {message ? (
          <p className={`mt-3 text-sm ${status === "error" ? "text-rose-600" : "text-emerald-600"}`}>
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={status === "saving"}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mode === "onboarding" ? "Зберегти і перейти" : "Зберегти"}
          </button>
          {mode === "settings" ? (
            <button
              type="button"
              onClick={() => router.push(`/${locale}`)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              На головну
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
