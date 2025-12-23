'use client';

const LEVELS = ['assisted', 'independent', 'advanced', 'mentor'];

export function InstrumentsPanel({ value = [], onChange }: any) {
  function add() {
    onChange([...value, { name: '', proficiency: 'assisted' }]);
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
      {value.map((inst: any, i: number) => (
        <div key={i} className="rounded border p-4 space-y-2">
          <input
            className="w-full border px-2 py-1"
            placeholder="Назва приладу"
            value={inst.name}
            onChange={(e) => update(i, 'name', e.target.value)}
          />
          <select
            className="border px-2 py-1"
            value={inst.proficiency}
            onChange={(e) => update(i, 'proficiency', e.target.value)}
          >
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button onClick={() => remove(i)} className="text-xs text-red-600">
            Видалити
          </button>
        </div>
      ))}
      <button onClick={add} className="text-sm underline">
        + Додати прилад
      </button>
    </div>
  );
}
