"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useParams } from "next/navigation";

export function LoginCard({
  title = "Вхід до Research OS",
  description = "Використай email і пароль, створені власником системи.",
}: {
  title?: string;
  description?: string;
}) {
  const params = useParams();
  const locale = params?.locale ?? "uk";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const result = await signIn("credentials", {
      redirect: true,
      email,
      password,
      callbackUrl: `/${locale}`,
    });

    if (result?.error) {
      setStatus("error");
      setMessage("Невірний email або пароль");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-md rounded-[28px] border border-stone-200/70 bg-white/85 p-0 shadow-[0_30px_80px_rgba(75,58,36,0.18)] backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-stone-200/70 px-6 py-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-stone-500">
          <span className="h-2 w-2 rounded-full bg-rose-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
        </div>
        <span className="text-xs font-semibold text-stone-500">Secure Login</span>
      </div>
      <div className="px-6 py-6">
        <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
        <p className="mt-2 text-sm text-stone-600">{description}</p>
        <div className="mt-6 space-y-4">
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
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-6 w-full rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 disabled:opacity-70"
        >
          Увійти
        </button>
        {message ? <p className="mt-3 text-sm text-rose-600">{message}</p> : null}
        <p className="mt-4 text-sm text-stone-600">
          Немає акаунта?{" "}
          <a className="font-semibold text-stone-900" href={`/${locale}/register`}>
            Зареєструватися
          </a>
        </p>
      </div>
    </form>
  );
}
