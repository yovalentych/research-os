export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6 shadow-[0_14px_40px_rgba(88,64,38,0.12)]">
        <h3 className="text-xl font-semibold">Панель старту</h3>
        <p className="mt-2 text-sm text-stone-600">
          Поки немає даних. Додай перший проєкт, експеримент або задачі.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50">
            Створити проєкт
          </button>
          <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">
            Додати експеримент
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
          <h3 className="text-xl font-semibold">Фокус тижня</h3>
          <p className="mt-2 text-sm text-stone-600">
            Додай перші задачі, щоб побачити фокус тижня.
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
          <h3 className="text-xl font-semibold">Блокери</h3>
          <p className="mt-2 text-sm text-stone-600">
            Немає активних блокерів.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h3 className="text-xl font-semibold">Найближчі дедлайни</h3>
        <p className="mt-2 text-sm text-stone-600">
          Додай дедлайни, щоб вони зʼявились у дашборді.
        </p>
      </section>
    </div>
  );
}
