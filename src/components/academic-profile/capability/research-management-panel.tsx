'use client';

const LEVELS = ['assisted', 'independent', 'advanced', 'mentor'];

export function ResearchManagementPanel({ value = [], onChange }: any) {
  function add() {
    onChange([...value, { area: '', proficiency: 'assisted' }]);
  }

  function update(i: number, field: string, val: string) {
    const next = [...value];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {value.map((r: any, i: number) => (
        <div key={i} className="rounded border p-4 space-y-2">
          <input
            className="w-full border px-2 py-1"
            placeholder="Сфера (design, data, ethics...)"
            value={r.area}
            onChange={(e) => update(i, 'area', e.target.value)}
          />
          <select
            className="border px-2 py-1"
            value={r.proficiency}
            onChange={(e) => update(i, 'proficiency', e.target.value)}
          >
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      ))}
      <button onClick={add} className="text-sm underline">
        + Додати компетенцію
      </button>
    </div>
  );
}
