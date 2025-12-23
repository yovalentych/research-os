"use client";

import { useEffect, useState } from "react";

type Project = { _id: string; title: string };
type Milestone = { _id: string; title: string };
type Manuscript = { _id: string; title: string };
type Experiment = { _id: string; title: string };
type FileItem = { _id: string; name: string };
type Material = { _id: string; name: string };
type Protocol = { _id: string; title: string };
type Note = { _id: string; title: string };
type Task = { _id: string; title: string };
type Scholarship = { _id: string; period?: string };
type Grant = { _id: string; title: string };

export function ArchivePanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [archivedMilestones, setArchivedMilestones] = useState<Milestone[]>([]);
  const [archivedManuscripts, setArchivedManuscripts] = useState<Manuscript[]>([]);
  const [archivedExperiments, setArchivedExperiments] = useState<Experiment[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<FileItem[]>([]);
  const [archivedKbAttachments, setArchivedKbAttachments] = useState<
    { _id: string; name: string }[]
  >([]);
  const [archivedTasks, setArchivedTasks] = useState<Record<string, Task[]>>({});
  const [archivedNotes, setArchivedNotes] = useState<Record<string, Note[]>>({});
  const [archivedMaterials, setArchivedMaterials] = useState<
    Record<string, Material[]>
  >({});
  const [archivedProtocols, setArchivedProtocols] = useState<
    Record<string, Protocol[]>
  >({});
  const [archivedScholarships, setArchivedScholarships] = useState<Scholarship[]>(
    []
  );
  const [archivedGrants, setArchivedGrants] = useState<Grant[]>([]);

  async function loadBase() {
    const [projectsResponse, archivedProjectsResponse] = await Promise.all([
      fetch("/api/projects?includeArchived=1"),
      fetch("/api/projects?archived=1"),
    ]);

    if (projectsResponse.ok) {
      setProjects(await projectsResponse.json());
    }
    if (archivedProjectsResponse.ok) {
      setArchivedProjects(await archivedProjectsResponse.json());
    }
  }

  async function loadGlobalArchived() {
    const [
      milestonesResponse,
      manuscriptsResponse,
      attachmentsResponse,
      scholarshipsResponse,
      grantsResponse,
    ] = await Promise.all([
      fetch("/api/milestones?archived=1"),
      fetch("/api/manuscripts?archived=1"),
      fetch("/api/knowledge-base/attachments?archived=1"),
      fetch("/api/finance/scholarships?archived=1"),
      fetch("/api/finance/grants?archived=1"),
    ]);
    if (milestonesResponse.ok) {
      setArchivedMilestones(await milestonesResponse.json());
    }
    if (manuscriptsResponse.ok) {
      setArchivedManuscripts(await manuscriptsResponse.json());
    }
    if (attachmentsResponse.ok) {
      setArchivedKbAttachments(await attachmentsResponse.json());
    }
    if (scholarshipsResponse.ok) {
      setArchivedScholarships(await scholarshipsResponse.json());
    }
    if (grantsResponse.ok) {
      setArchivedGrants(await grantsResponse.json());
    }
  }

  async function loadProjectArchived() {
    const projectIds = projects.map((project) => project._id);
    const experiments = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/experiments?projectId=${id}&archived=1`).then((response) =>
          response.ok ? response.json() : []
        )
      )
    );
    const files = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/files?projectId=${id}&archived=1`).then((response) =>
          response.ok ? response.json() : []
        )
      )
    );
    const tasks = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/projects/${id}/tasks?archived=1`).then((response) =>
          response.ok ? response.json() : []
        )
      )
    );
    const notes = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/projects/${id}/notes?archived=1`).then((response) =>
          response.ok ? response.json() : []
        )
      )
    );
    const materials = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/projects/${id}/materials?archived=1`).then((response) =>
          response.ok ? response.json() : []
        )
      )
    );
    const protocols = await Promise.all(
      projectIds.map((id) =>
        fetch(`/api/projects/${id}/protocols?archived=1`).then((response) =>
          response.ok ? response.json() : []
        )
      )
    );

    const experimentsFlat: Experiment[] = experiments.flat();
    const filesFlat: FileItem[] = files.flat();
    const tasksMap: Record<string, Task[]> = {};
    const notesMap: Record<string, Note[]> = {};
    const materialsMap: Record<string, Material[]> = {};
    const protocolsMap: Record<string, Protocol[]> = {};

    projectIds.forEach((id, index) => {
      tasksMap[id] = tasks[index] ?? [];
      notesMap[id] = notes[index] ?? [];
      materialsMap[id] = materials[index] ?? [];
      protocolsMap[id] = protocols[index] ?? [];
    });

    setArchivedExperiments(experimentsFlat);
    setArchivedFiles(filesFlat.filter((file) => file));
    setArchivedTasks(tasksMap);
    setArchivedNotes(notesMap);
    setArchivedMaterials(materialsMap);
    setArchivedProtocols(protocolsMap);
  }

  useEffect(() => {
    loadBase();
    loadGlobalArchived();
  }, []);

  useEffect(() => {
    if (projects.length) {
      loadProjectArchived();
    }
  }, [projects.length]);

  async function restoreProjectItem(url: string) {
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    loadBase();
    loadGlobalArchived();
    loadProjectArchived();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Архів</h3>
        <p className="mt-2 text-sm text-slate-600">
          Архівовані дані з можливістю відновлення.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h4 className="text-sm font-semibold uppercase text-slate-500">
            Проєкти
          </h4>
          <div className="mt-3 space-y-2">
            {archivedProjects.length === 0 ? (
              <p className="text-sm text-slate-500">Немає архівних проєктів.</p>
            ) : (
              archivedProjects.map((project) => (
                <div
                  key={project._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{project.title}</span>
                  <button
                    type="button"
                    onClick={() => restoreProjectItem(`/api/projects/${project._id}`)}
                    className="text-xs font-semibold text-slate-600"
                  >
                    Відновити
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h4 className="text-sm font-semibold uppercase text-slate-500">
            Загальні milestones
          </h4>
          <div className="mt-3 space-y-2">
            {archivedMilestones.length === 0 ? (
              <p className="text-sm text-slate-500">Архів порожній.</p>
            ) : (
              archivedMilestones.map((milestone) => (
                <div
                  key={milestone._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{milestone.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      restoreProjectItem(`/api/milestones/${milestone._id}`)
                    }
                    className="text-xs font-semibold text-slate-600"
                  >
                    Відновити
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h4 className="text-sm font-semibold uppercase text-slate-500">
            Стипендія
          </h4>
          <div className="mt-3 space-y-2">
            {archivedScholarships.length === 0 ? (
              <p className="text-sm text-slate-500">Архів порожній.</p>
            ) : (
              archivedScholarships.map((payment) => (
                <div
                  key={payment._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{payment.period ?? "Виплата"}</span>
                  <button
                    type="button"
                    onClick={() =>
                      restoreProjectItem(`/api/finance/scholarships/${payment._id}`)
                    }
                    className="text-xs font-semibold text-slate-600"
                  >
                    Відновити
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h4 className="text-sm font-semibold uppercase text-slate-500">
            Гранти
          </h4>
          <div className="mt-3 space-y-2">
            {archivedGrants.length === 0 ? (
              <p className="text-sm text-slate-500">Архів порожній.</p>
            ) : (
              archivedGrants.map((grant) => (
                <div
                  key={grant._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{grant.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      restoreProjectItem(`/api/finance/grants/${grant._id}`)
                    }
                    className="text-xs font-semibold text-slate-600"
                  >
                    Відновити
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h4 className="text-sm font-semibold uppercase text-slate-500">
          Манускрипти
        </h4>
        <div className="mt-3 space-y-2">
          {archivedManuscripts.length === 0 ? (
            <p className="text-sm text-slate-500">Архів порожній.</p>
          ) : (
            archivedManuscripts.map((manuscript) => (
              <div
                key={manuscript._id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span>{manuscript.title}</span>
                <button
                  type="button"
                  onClick={() =>
                    restoreProjectItem(`/api/manuscripts/${manuscript._id}`)
                  }
                  className="text-xs font-semibold text-slate-600"
                >
                  Відновити
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h4 className="text-sm font-semibold uppercase text-slate-500">
          Вкладення бази знань
        </h4>
        <div className="mt-3 space-y-2">
          {archivedKbAttachments.length === 0 ? (
            <p className="text-sm text-slate-500">Архів порожній.</p>
          ) : (
            archivedKbAttachments.map((file) => (
              <div
                key={file._id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    restoreProjectItem(`/api/knowledge-base/attachments/${file._id}`)
                  }
                  className="text-xs font-semibold text-slate-600"
                >
                  Відновити
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h4 className="text-sm font-semibold uppercase text-slate-500">
          Експерименти та файли
        </h4>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Експерименти</p>
            {archivedExperiments.length === 0 ? (
              <p className="text-sm text-slate-500">Архів порожній.</p>
            ) : (
              archivedExperiments.map((experiment) => (
                <div
                  key={experiment._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{experiment.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      restoreProjectItem(`/api/experiments/${experiment._id}`)
                    }
                    className="text-xs font-semibold text-slate-600"
                  >
                    Відновити
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Файли</p>
            {archivedFiles.length === 0 ? (
              <p className="text-sm text-slate-500">Архів порожній.</p>
            ) : (
              archivedFiles.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => restoreProjectItem(`/api/files/${file._id}`)}
                    className="text-xs font-semibold text-slate-600"
                  >
                    Відновити
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h4 className="text-sm font-semibold uppercase text-slate-500">
          Архів по проєктах
        </h4>
        <div className="mt-4 space-y-4">
          {projects.map((project) => (
            <div key={project._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{project.title}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Завдання</p>
                  {(archivedTasks[project._id] ?? []).map((task) => (
                    <div key={task._id} className="flex items-center justify-between text-xs text-slate-600">
                      <span>{task.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          restoreProjectItem(`/api/projects/${project._id}/tasks/${task._id}`)
                        }
                        className="font-semibold text-slate-600"
                      >
                        Відновити
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Нотатки</p>
                  {(archivedNotes[project._id] ?? []).map((note) => (
                    <div key={note._id} className="flex items-center justify-between text-xs text-slate-600">
                      <span>{note.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          restoreProjectItem(`/api/projects/${project._id}/notes/${note._id}`)
                        }
                        className="font-semibold text-slate-600"
                      >
                        Відновити
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Матеріали</p>
                  {(archivedMaterials[project._id] ?? []).map((material) => (
                    <div key={material._id} className="flex items-center justify-between text-xs text-slate-600">
                      <span>{material.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          restoreProjectItem(`/api/projects/${project._id}/materials/${material._id}`)
                        }
                        className="font-semibold text-slate-600"
                      >
                        Відновити
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Протоколи</p>
                  {(archivedProtocols[project._id] ?? []).map((protocol) => (
                    <div key={protocol._id} className="flex items-center justify-between text-xs text-slate-600">
                      <span>{protocol.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          restoreProjectItem(`/api/projects/${project._id}/protocols/${protocol._id}`)
                        }
                        className="font-semibold text-slate-600"
                      >
                        Відновити
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
