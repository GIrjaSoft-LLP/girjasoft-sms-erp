"use client";

import { useEffect, useMemo, useState } from "react";
import { ExcelActions } from "@/components/ExcelActions";
import { CredentialsDialog } from "@/components/CredentialsDialog";
import { PhotoField } from "@/components/PhotoField";
import { RecordDialog } from "@/components/RecordDialog";
import { isPrintableDocument } from "@/config/documents";
import { isExcelModule } from "@/config/excel";
import {
  FILTER_STATUS_OPTIONS,
  RESOURCE_FILTERS,
  WEEK_DAYS,
} from "@/config/list-view";
import { RESOURCES } from "@/config/resources";
import { api } from "@/lib/client";

type LookupRow = {
  _id: string;
  name: string;
  classId?: string;
  className?: string;
  admissionNumber?: string;
  sectionName?: string;
  numericName?: number;
  employeeId?: string;
};

function Avatar({ id, photo, name, kind }: { id: string; photo?: unknown; name?: unknown; kind: string }) {
  const [failed, setFailed] = useState(false);
  const src = photo && !failed ? `/api/${kind}/${id}/photo` : "";
  const letters = String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-9 w-9 rounded-full object-cover bg-slate-100" onError={() => setFailed(true)} />
    );
  }
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#0b1b3a] text-[10px] font-semibold text-white">
      {letters || "—"}
    </div>
  );
}

export function ModuleManager({
  resourceKey,
  viewPathPrefix,
  allowCreate = true,
  readOnly = false,
}: {
  resourceKey: string;
  viewPathPrefix?: string;
  allowCreate?: boolean;
  readOnly?: boolean;
}) {
  const resource = RESOURCES[resourceKey];
  const filters = RESOURCE_FILTERS[resourceKey] ?? [];
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [day, setDay] = useState("");
  const [classes, setClasses] = useState<LookupRow[]>([]);
  const [sections, setSections] = useState<LookupRow[]>([]);
  const [students, setStudents] = useState<LookupRow[]>([]);
  const [teachers, setTeachers] = useState<LookupRow[]>([]);
  const [credentials, setCredentials] = useState<{
    title: string;
    name?: string;
    username: string;
    temporaryPassword: string;
    role: string;
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const hasIdCards = resourceKey === "students" || resourceKey === "teachers";
  const usesClassPicker = resourceKey === "sections" || resourceKey === "subjects";

  const needsLookups = filters.includes("classId") || filters.includes("sectionId");

  async function load(next?: {
    q?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    date?: string;
    day?: string;
  }) {
    const params = new URLSearchParams();
    const search = next?.q ?? q;
    const nextClass = next?.classId ?? classId;
    const nextSection = next?.sectionId ?? sectionId;
    const nextStatus = next?.status ?? status;
    const nextDate = next?.date ?? date;
    const nextDay = next?.day ?? day;
    if (search.trim()) params.set("q", search.trim());
    if (nextClass) params.set("classId", nextClass);
    if (nextSection) params.set("sectionId", nextSection);
    if (nextStatus) params.set("status", nextStatus);
    if (nextDate) params.set("date", nextDate);
    if (nextDay) params.set("day", nextDay);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await api<{ items: Record<string, unknown>[] }>(`/api/${resourceKey}${suffix}`);
    setItems(data.items);
    setSelected([]);
  }

  useEffect(() => {
    if (!resource) return;
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey, classId, sectionId, status, date, day]);

  const needsTeacherLookup = resourceKey === "sections" || resourceKey === "timetable";

  useEffect(() => {
    if (!needsLookups && resourceKey !== "parents" && !needsTeacherLookup) return;
    const requests = [
      api<{ items: LookupRow[] }>("/api/classes").catch(() => ({ items: [] as LookupRow[] })),
      api<{ items: LookupRow[] }>("/api/sections").catch(() => ({ items: [] as LookupRow[] })),
    ];
    if (resourceKey === "parents") {
      requests.push(api<{ items: LookupRow[] }>("/api/students").catch(() => ({ items: [] as LookupRow[] })));
    }
    if (needsTeacherLookup) {
      requests.push(api<{ items: LookupRow[] }>("/api/teachers").catch(() => ({ items: [] as LookupRow[] })));
    }
    Promise.all(requests).then((results) => {
      setClasses(results[0].items);
      setSections(results[1].items);
      let index = 2;
      if (resourceKey === "parents") {
        setStudents(results[index]?.items ?? []);
        index += 1;
      }
      if (needsTeacherLookup) {
        setTeachers(results[index]?.items ?? []);
      }
    });
  }, [needsLookups, needsTeacherLookup, resourceKey]);

  const visibleSections = useMemo(
    () => (classId ? sections.filter((row) => String(row.classId) === classId) : sections),
    [classId, sections],
  );

  if (!resource) return <p>Unknown module.</p>;

  function openCreate() {
    setEditing(null);
    const defaults: Record<string, string> = {};
    if (resourceKey === "staff") {
      defaults.status = "ACTIVE";
      defaults.enablePortalLogin = "true";
    }
    setForm(defaults);
    setFormError("");
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoUrl("");
    setDialogOpen(true);
  }

  function openEdit(item: Record<string, unknown>) {
    const next: Record<string, string> = {};
    for (const field of resource.fields) {
      next[field.name] = String(item[field.name] ?? "");
    }
    if ((resourceKey === "sections" || resourceKey === "subjects") && !next.classOrder && item.classOrder != null) {
      next.classOrder = String(item.classOrder);
    }
    setEditing(String(item._id));
    setForm(next);
    setFormError("");
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoUrl(item.photo ? `/api/${resourceKey}/${String(item._id)}/photo` : "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm({});
    setFormError("");
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoUrl("");
  }

  async function persistPhoto(id: string) {
    if (!hasIdCards) return;
    if (photoFile) {
      const body = new FormData();
      body.append("file", photoFile);
      const response = await fetch(`/api/${resourceKey}/${id}/photo`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || "Photo upload failed");
    } else if (removePhoto) {
      const response = await fetch(`/api/${resourceKey}/${id}/photo`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || "Could not remove photo");
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const payload: Record<string, unknown> = { ...form };
    for (const field of resource.fields) {
      if (field.type === "number" && payload[field.name] !== undefined && payload[field.name] !== "") {
        payload[field.name] = Number(payload[field.name]);
      }
    }
    try {
      let recordId = editing;
      if (editing) {
        const data = await api<{ login?: { name?: string; username: string; temporaryPassword: string; role: string } }>(
          `/api/${resourceKey}/${editing}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        if (data.login?.temporaryPassword) setCredentials({
          title: `${resource.label} login created.`,
          name: data.login.name,
          ...data.login,
        });
      } else {
        const data = await api<{
          item?: { _id?: string };
          login?: { name?: string; username: string; email?: string; temporaryPassword: string; role: string };
        }>(`/api/${resourceKey}`, { method: "POST", body: JSON.stringify(payload) });
        recordId = data.item?._id ? String(data.item._id) : null;
        if (data.login?.temporaryPassword) {
          setCredentials({
            title: `${resource.label.replace(/s$/, "")} created successfully.`,
            name: data.login.name || String(payload.name ?? ""),
            username: data.login.username || data.login.email || "",
            temporaryPassword: data.login.temporaryPassword,
            role: data.login.role || resource.label.replace(/s$/, ""),
          });
        }
      }
      if (recordId) await persistPhoto(recordId);
      closeDialog();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    await api(`/api/${resourceKey}/${id}`, { method: "DELETE" });
    await load();
  }

  function resetFilters() {
    setQ("");
    setClassId("");
    setSectionId("");
    setStatus("");
    setDate("");
    setDay("");
    load({ q: "", classId: "", sectionId: "", status: "", date: "", day: "" }).catch((err) => setError(err.message));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0b1b3a]">{resource.label}</h1>
          <p className="text-sm text-slate-500">
            Workspace-scoped records stored in MongoDB.
            {isExcelModule(resourceKey)
              ? " Download the template, fill rows using Class Name (not Class ID), then Import Excel."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isExcelModule(resourceKey) ? (
            <ExcelActions
              exportUrl={`/api/excel/${resourceKey}`}
              templateUrl={`/api/excel/${resourceKey}?template=1`}
              importUrl={`/api/excel/${resourceKey}`}
              onImported={load}
            />
          ) : null}
          {hasIdCards && selected.length ? (
            <a
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-[#0b1b3a] hover:bg-slate-50"
              href={`/print/id-cards?kind=${resourceKey}&ids=${selected.join(",")}`}
              target="_blank"
              rel="noreferrer"
            >
              Download ID Cards ({selected.length})
            </a>
          ) : null}
          {allowCreate ? (
            <button type="button" className="gs-btn px-4 py-2" onClick={openCreate}>
              Create
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <div className="gs-card p-4 grid md:grid-cols-6 gap-3 items-end">
        <label className="text-sm md:col-span-2">
          <span className="block mb-1 text-slate-600">Search</span>
          <input
            className="gs-input"
            placeholder="Search this list"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                load().catch((err) => setError(err.message));
              }
            }}
          />
        </label>
        {filters.includes("classId") ? (
          <label className="text-sm">
            <span className="block mb-1 text-slate-600">Class</span>
            <select
              className="gs-input"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
              }}
            >
              <option value="">All classes</option>
              {classes.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {filters.includes("sectionId") ? (
          <label className="text-sm">
            <span className="block mb-1 text-slate-600">Section</span>
            <select className="gs-input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All sections</option>
              {visibleSections.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.className ? `${row.className} ${row.name}` : row.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {filters.includes("status") ? (
          <label className="text-sm">
            <span className="block mb-1 text-slate-600">Status</span>
            <select className="gs-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {(FILTER_STATUS_OPTIONS[resourceKey] ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {filters.includes("date") ? (
          <label className="text-sm">
            <span className="block mb-1 text-slate-600">Date</span>
            <input className="gs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        ) : null}
        {filters.includes("day") ? (
          <label className="text-sm">
            <span className="block mb-1 text-slate-600">Day</span>
            <select className="gs-input" value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">All days</option>
              {WEEK_DAYS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex gap-2">
          <button type="button" className="gs-btn px-4 py-2" onClick={() => load().catch((err) => setError(err.message))}>
            Search
          </button>
          <button type="button" className="px-3 py-2 text-sm text-slate-600" onClick={resetFilters}>
            Reset
          </button>
        </div>
        <p className="text-xs text-slate-500 md:col-span-6">{items.length} record(s)</p>
      </div>

      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {hasIdCards ? (
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.length === items.length}
                    onChange={(event) => {
                      setSelected(event.target.checked ? items.map((item) => String(item._id)) : []);
                    }}
                    aria-label="Select all"
                  />
                </th>
              ) : null}
              {resource.columns.map((col) => (
                <th key={col.key} className="p-3 font-medium">
                  {col.label}
                </th>
              ))}
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item._id)} className="border-t border-slate-100">
                {hasIdCards ? (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(String(item._id))}
                      onChange={(event) => {
                        const id = String(item._id);
                        setSelected((current) =>
                          event.target.checked ? [...current, id] : current.filter((value) => value !== id),
                        );
                      }}
                      aria-label={`Select ${String(item.name ?? "")}`}
                    />
                  </td>
                ) : null}
                {resource.columns.map((col) => (
                  <td key={col.key} className="p-3">
                    {col.key === "photo" ? (
                      <Avatar id={String(item._id)} photo={item.photo} name={item.name} kind={resourceKey} />
                    ) : (
                      String(item[col.key] ?? "")
                    )}
                  </td>
                ))}
                <td className="p-3 space-x-2">
                  {viewPathPrefix && resourceKey === "teachers" ? (
                    <a className="text-[#4c7eff]" href={`${viewPathPrefix}/${String(item._id)}`}>
                      View
                    </a>
                  ) : null}
                  {viewPathPrefix && resourceKey === "students" ? (
                    <a className="text-[#4c7eff]" href={`${viewPathPrefix}/${String(item._id)}`}>
                      View
                    </a>
                  ) : null}
                  {!readOnly ? (
                    <>
                      <button className="text-[#4c7eff]" onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      <button className="text-red-600" onClick={() => remove(String(item._id))}>
                        Delete
                      </button>
                    </>
                  ) : null}
                  {hasIdCards ? (
                    <a
                      className="text-emerald-700"
                      href={`/print/id-cards?kind=${resourceKey}&ids=${String(item._id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download ID Card
                    </a>
                  ) : null}
                  {resourceKey === "parents" || resourceKey === "teachers" ? (
                    <>
                      <button
                        className="text-[#4c7eff]"
                        onClick={async () => {
                          const data = await api<{
                            login: { name?: string; username: string; temporaryPassword: string; role: string };
                          }>(`/api/${resourceKey}/${String(item._id)}/reset-password`, { method: "POST" });
                          setCredentials({
                            title: `${resource.label.replace(/s$/, "")} login credentials`,
                            name: data.login.name || String(item.name ?? ""),
                            username: data.login.username,
                            temporaryPassword: data.login.temporaryPassword,
                            role: data.login.role,
                          });
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        className="text-amber-700"
                        onClick={async () => {
                          const next = item.loginStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
                          await api(`/api/${resourceKey}/${String(item._id)}/account`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: next }),
                          });
                          await load();
                        }}
                      >
                        {item.loginStatus === "ACTIVE" ? "Disable login" : "Enable login"}
                      </button>
                    </>
                  ) : null}
                  {isPrintableDocument(resourceKey) ? (
                    <a
                      className="text-emerald-700"
                      href={`/print/${resourceKey}/${String(item._id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Print
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={resource.columns.length + (hasIdCards ? 2 : 1)}>
                  No records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {dialogOpen ? (
        <RecordDialog title={editing ? `Edit ${resource.label}` : `Create ${resource.label}`} onClose={closeDialog}>
          <form onSubmit={save} className="grid md:grid-cols-2 gap-3">
            {resource.fields.map((field) =>
              usesClassPicker && field.name === "classId" ? (
                <label key={field.name} className="text-sm md:col-span-2">
                  <span className="block mb-1 text-slate-600">Class</span>
                  <select
                    className="gs-input"
                    value={form.classId ?? ""}
                    onChange={(e) => {
                      const selected = classes.find((row) => row._id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        classId: e.target.value,
                        classOrder:
                          selected?.numericName != null ? String(selected.numericName) : (f.classOrder ?? ""),
                      }));
                    }}
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : resourceKey === "parents" && field.name === "studentIds" ? (
                <label key={field.name} className="text-sm md:col-span-2">
                  <span className="block mb-1 text-slate-600">Linked students</span>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
                    {students.map((student) => {
                      const selected = (form.studentIds ?? "").split(",").filter(Boolean);
                      const checked = selected.includes(student._id);
                      return (
                        <label key={student._id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? selected.filter((id) => id !== student._id)
                                : [...selected, student._id];
                              setForm((f) => ({ ...f, studentIds: next.join(",") }));
                            }}
                          />
                          <span>
                            {student.name} {student.admissionNumber ? `(${student.admissionNumber})` : ""}{" "}
                            {student.className ? `· ${student.className} ${student.sectionName ?? ""}` : ""}
                          </span>
                        </label>
                      );
                    })}
                    {!students.length ? <p className="text-slate-500 text-sm">No students found.</p> : null}
                  </div>
                </label>
              ) : (resourceKey === "sections" && field.name === "classTeacherId") ||
                (resourceKey === "timetable" && field.name === "teacherId") ? (
                <label key={field.name} className="text-sm">
                  <span className="block mb-1 text-slate-600">{field.label}</span>
                  <select
                    className="gs-input"
                    value={form[field.name] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  >
                    <option value="">None</option>
                    {teachers.map((teacher) => (
                      <option key={teacher._id} value={teacher._id}>
                        {teacher.name}
                        {teacher.employeeId ? ` (${teacher.employeeId})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
              <label key={field.name} className={`text-sm ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                <span className="block mb-1 text-slate-600">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    className="gs-input"
                    value={form[field.name] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="gs-input"
                    value={form[field.name] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                    required={field.required}
                  >
                    <option value="">Select</option>
                    {field.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="gs-input"
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    min={
                      resourceKey === "sections" && field.name === "capacity"
                        ? 1
                        : usesClassPicker && field.name === "classOrder"
                          ? 0
                          : undefined
                    }
                    step={resourceKey === "sections" && field.name === "capacity" ? 1 : undefined}
                    value={form[field.name] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                    required={field.required}
                  />
                )}
              </label>
              ),
            )}
            {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}
            {hasIdCards ? (
              <PhotoField
                label={resourceKey === "teachers" ? "Teacher photo" : "Student photo"}
                name={form.name}
                photo={photoUrl}
                onPhotoChange={(file, remove) => {
                  setPhotoFile(file);
                  setRemovePhoto(remove);
                  if (file) setPhotoUrl(URL.createObjectURL(file));
                  if (remove) setPhotoUrl("");
                }}
              />
            ) : null}
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" className="px-3 py-2 text-sm text-slate-600" onClick={closeDialog}>
                Cancel
              </button>
              <button className="gs-btn px-4 py-2">
                {resourceKey === "sections"
                  ? editing
                    ? "Update Section"
                    : "Create Section"
                  : resourceKey === "subjects"
                    ? editing
                      ? "Update Subject"
                      : "Create Subject"
                    : editing
                      ? "Update"
                      : "Create"}
              </button>
            </div>
          </form>
        </RecordDialog>
      ) : null}
      {credentials ? (
        <CredentialsDialog
          title={credentials.title}
          name={credentials.name}
          username={credentials.username}
          password={credentials.temporaryPassword}
          role={credentials.role}
          onClose={() => setCredentials(null)}
        />
      ) : null}
    </div>
  );
}
