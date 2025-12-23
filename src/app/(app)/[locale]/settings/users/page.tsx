import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { UsersPanel } from "@/components/users-panel";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  if (session.user.role !== "Owner") {
    return (
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h3 className="text-xl font-semibold">Доступ обмежений</h3>
        <p className="mt-2 text-sm text-stone-600">
          Тільки власник може керувати користувачами.
        </p>
      </section>
    );
  }

  await connectToDatabase();
  const users = await User.find().select("-passwordHash").lean();

  return (
    <div className="flex flex-col gap-6">
      <UsersPanel users={users.map((user) => ({
        _id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        globalRole: user.globalRole,
        createdAt: user.createdAt?.toISOString(),
      }))} />
    </div>
  );
}
