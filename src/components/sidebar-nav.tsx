"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Activity,
  Archive,
  BadgeCheck,
  Building2,
  Library,
  FileText,
  Flag,
  FlaskConical,
  FolderKanban,
  Coins,
  LayoutDashboard,
  ScrollText,
  Users,
  Vault,
  Wallet,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { navSections } from "@/lib/navigation";

const iconMap = {
  LayoutDashboard,
  FolderKanban,
  FlaskConical,
  Vault,
  FileText,
  Flag,
  Activity,
  Archive,
  BadgeCheck,
  Building2,
  Library,
  ScrollText,
  Users,
  Wallet,
  Coins,
};

function isActive(pathname: string, href: string, locale: Locale) {
  const base = `/${locale}`;
  const target = href ? `${base}/${href}` : base;
  if (href === "") {
    return pathname === base;
  }
  return pathname.startsWith(target);
}

export function SidebarNav({ locale, role }: { locale: Locale; role?: string }) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState(() => ({
    core: true,
    research: false,
    finance: false,
    admin: false,
  }));
  const [projectTitle, setProjectTitle] = useState<string | null>(null);

  const projectSubItem = useMemo(() => {
    const match = pathname.match(new RegExp(`^/${locale}/projects/([^/]+)`));
    if (!match) return null;
    return {
      id: "project-current",
      label: projectTitle ?? "Поточний проєкт",
      href: `projects/${match[1]}`,
      icon: "FolderKanban",
      isChild: true,
      projectId: match[1],
    };
  }, [pathname, locale, projectTitle]);

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => isActive(pathname, item.href, locale))
    );

    if (!activeSection) {
      return;
    }

    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      navSections.forEach((section) => {
        next[section.id] = section.id === activeSection.id;
      });
      return { ...prev, ...next };
    });
  }, [pathname, locale]);

  useEffect(() => {
    if (!projectSubItem) return;

    const controller = new AbortController();
    fetch(`/api/projects/${projectSubItem.projectId}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.title) {
          setProjectTitle(data.title);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [projectSubItem?.projectId]);

  return (
    <div className="mt-6 space-y-6">
      {navSections.map((section) => (
        <div key={section.title}>
          <button
            type="button"
            onClick={() =>
              setOpenSections((prev) => ({
                ...prev,
                [section.id]: !prev[section.id as keyof typeof prev],
              }))
            }
            className="flex w-full items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-400"
          >
            {section.title}
            <ChevronDown
              className={`h-4 w-4 transition ${
                openSections[section.id as keyof typeof openSections]
                  ? "rotate-0"
                  : "-rotate-90"
              }`}
            />
          </button>
          {openSections[section.id as keyof typeof openSections] ? (
            <nav className="mt-3 flex flex-col gap-1">
              {section.items
                .filter((item) => {
                  if (item.id === "users") {
                    return role === "Owner";
                  }
                  if (item.id === "audit") {
                    return role === "Owner" || role === "Supervisor" || role === "Mentor";
                  }
                  if (item.id === "archive") {
                    return role === "Owner" || role === "Supervisor" || role === "Mentor";
                  }
                  if (item.id === "affiliations") {
                    return role === "Owner" || role === "Supervisor" || role === "Mentor";
                  }
                  if (item.id === "org-sources") {
                    return role === "Owner" || role === "Supervisor" || role === "Mentor";
                  }
                  return true;
                })
                .flatMap((item) => {
                  if (item.id === "projects" && projectSubItem) {
                    return [item, projectSubItem];
                  }
                  return [item];
                })
                .map((item) => {
                  const active = isActive(pathname, item.href, locale);
                  const Icon = iconMap[item.icon as keyof typeof iconMap];
                  return (
                    <Link
                      key={item.id}
                      href={`/${locale}/${item.href}`}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      } ${item.isChild ? "ml-6" : ""}`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          active ? "bg-white/15" : "bg-slate-100"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
          ) : null}
        </div>
      ))}
    </div>
  );
}
