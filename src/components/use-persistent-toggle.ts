"use client";

import { useEffect, useState } from "react";

export function usePersistentToggle(key: string, initialValue = false) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      setValue(stored === "true");
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue] as const;
}
