'use client';

const LEVELS = ['assisted', 'independent', 'advanced', 'mentor'];

export function MethodsPanel({ value = [], onChange }: any) {
  function add() {
    onChange([...value, { name: '', proficiency: 'assisted' }]);
  }

  function update(i: number, field: string, val: string) {
    const next = [...value];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {value.map((m: any, i: number) => (
        <div key={i} className="rounded border p-4 space-y-2">
          <input
            className="w-full border px-2 py-1"
            placeholder="Метод"
            value={m.name}
            onChange={(e) => update(i, 'name', e.target.value)}
          />
          <select
            className="border px-2 py-1"
            value={m.proficiency}
            onChange={(e) => update(i, 'proficiency', e.target.value)}
          >
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      ))}
      <button onClick={add} className="text-sm underline">
        + Додати метод
      </button>
    </div>
  );
}
