"use client";

import { ReactNode } from "react";

export function FormReveal({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`transition-all duration-300 ease-out overflow-hidden ${
        open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      } ${open ? "pointer-events-auto" : "pointer-events-none"} ${className ?? ""}`}
    >
      <div className={`transition-transform duration-300 ${open ? "translate-y-0 pt-4" : "-translate-y-2 pt-0"}`}>
        {children}
      </div>
    </div>
  );
}
