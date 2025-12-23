"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
      if (event.key === "Enter") {
        signOut({ callbackUrl: "/uk/public" });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-sm text-stone-700"
      >
        Завершити сесію
      </button>
      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="relative w-full max-w-lg rounded-3xl border border-stone-200/80 bg-white/95 p-7 shadow-[0_30px_80px_rgba(75,58,36,0.24)]">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  Підтвердження
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-stone-900">
                  Завершити сесію?
                </h3>
                <p className="mt-2 text-sm text-stone-600">
                  Ти впевнений, що хочеш вийти? Несинхронізовані зміни можуть бути втрачені.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/uk/public" })}
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50"
                  >
                    Так, вийти
                  </button>
                </div>
                <p className="mt-4 text-xs text-stone-400">
                  Enter — вийти · Esc — скасувати
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
