'use client';

import { AcademicProfile } from '@/types/academic-profile';
import { EducationPanel } from './education/education-panel';
import { InstrumentsPanel } from './capability/instruments-panel';
import { MethodsPanel } from './capability/methods-panel';
import { ApproachesPanel } from './capability/approaches-panel';
import { ResearchManagementPanel } from './capability/research-management-panel';

type ACPEditorProps = {
  profile: AcademicProfile;
  onChange: (next: AcademicProfile) => void;
};

export function ACPEditor({ profile, onChange }: ACPEditorProps) {
  function update<K extends keyof AcademicProfile>(
    key: K,
    value: AcademicProfile[K]
  ) {
    onChange({
      ...profile,
      [key]: value,
    });
  }

  function updateCapability<K extends keyof AcademicProfile['capabilities']>(
    key: K,
    value: AcademicProfile['capabilities'][K]
  ) {
    onChange({
      ...profile,
      capabilities: {
        ...profile.capabilities,
        [key]: value,
      },
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Освіта</h2>
        <EducationPanel
          value={profile.education}
          onChange={(v) => update('education', v)}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Прилади</h2>
        <InstrumentsPanel
          value={profile.capabilities.instruments}
          onChange={(v) => updateCapability('instruments', v)}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Методи</h2>
        <MethodsPanel
          value={profile.capabilities.methods}
          onChange={(v) => updateCapability('methods', v)}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Методологічні підходи</h2>
        <ApproachesPanel
          value={profile.capabilities.approaches}
          onChange={(v) => updateCapability('approaches', v)}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Управління дослідженнями</h2>
        <ResearchManagementPanel
          value={profile.capabilities.researchManagement}
          onChange={(v) => updateCapability('researchManagement', v)}
        />
      </section>
    </div>
  );
}
