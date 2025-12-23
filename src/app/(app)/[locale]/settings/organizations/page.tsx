import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isElevatedRole } from "@/lib/access";
import { OrganizationSourcesPanel } from "@/components/organization-sources-panel";

export default async function OrganizationSourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return null;
  }

  if (!isElevatedRole(session.user.role)) {
    return (
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h3 className="text-xl font-semibold">Доступ обмежений</h3>
        <p className="mt-2 text-sm text-stone-600">
          Тільки власник або керівник можуть оновлювати реєстри.
        </p>
      </section>
    );
  }

  return <OrganizationSourcesPanel />;
}
