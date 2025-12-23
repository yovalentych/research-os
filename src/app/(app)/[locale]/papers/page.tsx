export default function PapersPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
        <h4 className="text-lg font-semibold">Спільні публікації з власником</h4>
        <p className="mt-2 text-sm text-stone-600">
          Тут будуть відображатися спільні рукописи та статуси підготовки.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
          <h4 className="text-lg font-semibold">Figure registry</h4>
          <p className="mt-2 text-sm text-stone-600">
            Поки немає фігур. Додай першу фігуру і прив&apos;яжи дані.
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200/70 bg-white/70 p-6">
          <h4 className="text-lg font-semibold">Checklist submission</h4>
          <p className="mt-2 text-sm text-stone-600">
            Чекліст буде зʼявлятися, коли додаси журнал і фігури.
          </p>
        </div>
      </section>
    </div>
  );
}
