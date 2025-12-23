'use client';

export function ApproachesPanel({ value = [], onChange }: any) {
  function add() {
    onChange([...value, { name: '' }]);
  }

  function update(i: number, val: string) {
    const next = [...value];
    next[i] = { name: val };
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {value.map((a: any, i: number) => (
        <input
          key={i}
          className="w-full border px-2 py-1"
          placeholder="Підхід"
          value={a.name}
          onChange={(e) => update(i, e.target.value)}
        />
      ))}
      <button onClick={add} className="text-sm underline">
        + Додати підхід
      </button>
    </div>
  );
}
