"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

export function RegisterCard() {
  const params = useParams();
  const locale = params?.locale ?? "uk";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [latinFirstName, setLatinFirstName] = useState("");
  const [latinLastName, setLatinLastName] = useState("");
  const [autoLatin, setAutoLatin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [degreeCompleted, setDegreeCompleted] = useState(degreeLevels[0]);
  const [degreeInProgress, setDegreeInProgress] = useState("");
  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<OrganizationOption[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const orgTimerRef = useRef<number | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationOption | null>(null);
  const [orgSource, setOrgSource] = useState<"all" | "edbo" | "ror">("all");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLatin) return;
    setLatinFirstName(transliterateUkrainian(firstName));
  }, [firstName, autoLatin]);

  useEffect(() => {
    if (!autoLatin) return;
    setLatinLastName(transliterateUkrainian(lastName));
  }, [lastName, autoLatin]);

  useEffect(() => {
    if (orgTimerRef.current) {
      window.clearTimeout(orgTimerRef.current);
    }
    if (!orgQuery.trim() || orgQuery.trim().length < 3) {
      setOrgResults([]);
      setSelectedOrg(null);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const organization = selectedOrg
      ? selectedOrg
      : orgQuery.trim()
        ? { name: orgQuery.trim() }
        : null;

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        latinFirstName,
        latinLastName,
        degreeCompleted,
        degreeInProgress,
        organization,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(data.error ?? "Не вдалося створити акаунт");
      return;
    }

    setStatus("success");
    setMessage("Акаунт створено. Входимо...");
    await signIn("credentials", {
      redirect: true,
      email,
      password,
      callbackUrl: `/${locale}/onboarding`,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-2xl rounded-[28px] border border-stone-200/70 bg-white/90 p-0 shadow-[0_30px_80px_rgba(75,58,36,0.18)] backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-stone-200/70 px-6 py-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-stone-500">
          <span className="h-2 w-2 rounded-full bg-rose-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
        </div>
        <span className="text-xs font-semibold text-stone-500">Research OS</span>
      </div>
      <div className="px-6 py-6">
        <h1 className="text-2xl font-semibold text-stone-900">Створення акаунта</h1>
        <p className="mt-2 text-sm text-stone-600">
          Заповни дані дослідника та організацію, щоб почати працювати.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Ім&apos;я
            <input
              type="text"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Прізвище
            <input
              type="text"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            First name (Latin)
            <input
              type="text"
              value={latinFirstName}
              onChange={(event) => {
                setAutoLatin(false);
                setLatinFirstName(event.target.value);
              }}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Last name (Latin)
            <input
              type="text"
              value={latinLastName}
              onChange={(event) => {
                setAutoLatin(false);
                setLatinLastName(event.target.value);
              }}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Пароль
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Отриманий ступінь
            <select
              value={degreeCompleted}
              onChange={(event) => setDegreeCompleted(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            >
              {degreeLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            У процесі здобуття (необов&apos;язково)
            <select
              value={degreeInProgress}
              onChange={(event) => setDegreeInProgress(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            >
              <option value="">Не в процесі</option>
              {degreeLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700 md:col-span-2">
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
                      ? "bg-stone-900 text-white"
                      : "border border-stone-200 text-stone-600"
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
              placeholder="Почни вводити назву університету або інституту"
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
            />
          </label>
        </div>
        {orgLoading ? (
          <p className="mt-2 text-xs text-stone-500">Пошук організацій...</p>
        ) : null}
        {orgResults.length > 0 ? (
          <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-stone-200 bg-white text-sm text-stone-700">
            {orgResults.map((option, index) => (
              <button
                key={`${option.edboId ?? option.rorId ?? option.name}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedOrg(option);
                  setOrgQuery(option.name);
                  setOrgResults([]);
                }}
                className="flex w-full items-start justify-between gap-2 border-b border-stone-100 px-3 py-2 text-left hover:bg-stone-50"
              >
                <div>
                  <p className="font-semibold text-stone-900">{option.name}</p>
                  <p className="text-xs text-stone-500">
                    {option.city ? `${option.city}, ` : ""}{option.country ?? ""}
                    {option.edrpou ? ` · ЄДРПОУ ${option.edrpou}` : ""}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">
                  {option.source === "edbo" ? "ЄДЕБО" : option.rorId ? "ROR" : "ORG"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-6 w-full rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 disabled:opacity-70"
        >
          Створити акаунт
        </button>
        {message ? <p className="mt-3 text-sm text-rose-600">{message}</p> : null}
        <p className="mt-4 text-sm text-stone-600">
          Уже маєш акаунт?{" "}
          <Link className="font-semibold text-stone-900" href={`/${locale}/login`}>
            Увійти
          </Link>
        </p>
      </div>
    </form>
  );
}
