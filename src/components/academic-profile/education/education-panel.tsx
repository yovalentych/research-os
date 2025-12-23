'use client';

export function EducationPanel({ value = [], onChange }: any) {
  function add() {
    onChange([
      ...value,
      {
        institution: '',
        programLevel: 'phd',
        startDate: '',
      },
    ]);
  }

  function update(i: number, field: string, val: string) {
    const next = [...value];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  }

  function remove(i: number) {
    onChange(value.filter((_: any, idx: number) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {value.map((e: any, i: number) => (
        <div key={i} className="rounded border p-4 space-y-2">
          <input
            className="w-full border px-2 py-1"
            placeholder="Університет / Інституція"
            value={e.institution}
            onChange={(ev) => update(i, 'institution', ev.target.value)}
          />
          <input
            className="w-full border px-2 py-1"
            placeholder="Спеціалізація"
            value={e.specialization || ''}
            onChange={(ev) => update(i, 'specialization', ev.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="border px-2 py-1"
              value={e.startDate}
              onChange={(ev) => update(i, 'startDate', ev.target.value)}
            />
            <input
              type="date"
              className="border px-2 py-1"
              value={e.endDate || ''}
              onChange={(ev) => update(i, 'endDate', ev.target.value)}
            />
          </div>
          <button onClick={() => remove(i)} className="text-xs text-red-600">
            Видалити
          </button>
        </div>
      ))}
      <button onClick={add} className="text-sm underline">
        + Додати освіту
      </button>
    </div>
  );
}
