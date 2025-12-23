export function ACPSummary({ profile }: any) {
  return (
    <div className="rounded border p-4 space-y-2 text-sm">
      <div>
        <b>Освіта:</b> {profile.education.length}
      </div>
      <div>
        <b>Прилади:</b> {profile.capabilities.instruments.length}
      </div>
      <div>
        <b>Методи:</b> {profile.capabilities.methods.length}
      </div>
      <div>
        <b>Підходи:</b> {profile.capabilities.approaches.length}
      </div>
    </div>
  );
}
