import type { Locale } from "@/lib/i18n";

export default async function PublicLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <div lang={locale}>{children}</div>;
}
