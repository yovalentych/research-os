import type { Locale } from "@/lib/i18n";
import { LogoutButton } from "@/components/logout-button";
import { NotificationsBell } from "@/components/notifications-bell";
import { OverdueIndicator } from "@/components/overdue-indicator";
import { ProfileSummary } from "@/components/profile-summary";
import { SidebarNav } from "@/components/sidebar-nav";
import { BillingSummary } from "@/components/billing-summary";

export function AppShell({
  locale,
  role,
  children,
}: {
  locale: Locale;
  role?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white px-6 py-6 shadow-sm md:flex">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-slate-50 flex items-center justify-center text-sm font-semibold">
            RO
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Research OS
            </p>
            <p className="text-base font-semibold text-slate-900">
              Докторська панель
            </p>
          </div>
        </div>
        <SidebarNav locale={locale} role={role} />
        <BillingSummary locale={locale} />
      </aside>

      <div className="min-h-screen md:ml-64 flex flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Research OS
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">
                Dashboard
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <ProfileSummary />
              <OverdueIndicator />
              <NotificationsBell />
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {children}
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-8 py-4 text-xs text-slate-500">
            <span>Research OS · версія MVP</span>
            <span>Private workspace</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
