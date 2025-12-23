"use client";

import { useEffect } from "react";

export function useAutoFocus(
  active: boolean,
  ref: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const target = container.querySelector(
      "input, textarea, select, .ql-editor"
    ) as HTMLElement | null;
    if (target) {
      target.focus();
    }
  }, [active, ref]);
}
