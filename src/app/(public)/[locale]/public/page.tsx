import Link from "next/link";
import { LoginCard } from "@/components/login-card";

export default function PublicPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f5efe4,_#f2e7d7_45%,_#ebe1cf_100%)] text-stone-950">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
            Research OS
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-stone-900 md:text-5xl">
            Операційна система для твоєї дисертації, лабораторії та публікацій.
          </h1>
          <p className="mt-4 text-base text-stone-600">
            Один простір для експериментів, протоколів, файлів, фінансів і
            драфтів. Приватна платформа з повним аудитом змін та контрольованим
            доступом.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/uk/login"
              className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-stone-50"
            >
              Увійти
            </Link>
            <span className="rounded-full border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-700">
              Доступ лише за запрошенням
            </span>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              "Експерименти та протоколи з версіями",
              "Кандидати, канбан і лабораторний журнал",
              "Файлове сховище з прив'язками",
              "Publication factory + блоки дисертації",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-stone-200/70 bg-white/70 p-4"
              >
                <p className="text-sm font-medium text-stone-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <LoginCard
            title="Доступ для учасників"
            description="Увійди, якщо маєш запрошення від власника проєкту."
          />
        </div>
      </div>
    </div>
  );
}
