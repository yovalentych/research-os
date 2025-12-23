import { getServerSession } from "next-auth";
import type { Locale } from "@/lib/i18n";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  return (
    <AppShell locale={locale} role={session?.user.role}>
      {children}
    </AppShell>
  );
}
