export function ACPPublicView({ profile }: any) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{profile.title}</h1>

      <section>
        <h2 className="font-semibold">Методи</h2>
        <ul>
          {profile.capabilities.methods.map((m: any, i: number) => (
            <li key={i}>
              {m.name} — {m.proficiency}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">Прилади</h2>
        <ul>
          {profile.capabilities.instruments.map((i: any, idx: number) => (
            <li key={idx}>{i.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
