"use client";

import { useMemo, useRef, useState } from "react";

type Option = { _id: string; name: string; classId?: string };
type PreviewError = { excelRow: number; studentName: string; subjectName?: string; message: string };
type PreviewUpdate = {
  excelRow: number;
  studentName: string;
  subjectName: string;
  existingGained: number;
  newGained: number;
};
type ImportRow = {
  excelRow: number;
  studentId: string;
  classId: string;
  sectionId: string;
  studentName: string;
  subjects: Array<{ subjectId: string; maxMarks: number; marksObtained: number }>;
};
type Preview = {
  examName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  updateRows: number;
  errors: PreviewError[];
  updates: PreviewUpdate[];
  importRows: ImportRow[];
  errorReport: string;
};
type ImportResult = {
  message: string;
  totalRows: number;
  imported: number;
  created: number;
  updated: number;
  failed: number;
  errorReport?: string;
};

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

async function downloadTemplate(url: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not download the template.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = match?.[1] ?? "marks-template.xlsx";
  link.click();
  URL.revokeObjectURL(href);
}

export function BulkMarksUpload({
  exams,
  classes,
  sections,
  onClose,
  onImported,
}: {
  exams: Option[];
  classes: Option[];
  sections: Option[];
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const selectedExam = exams.find((row) => row._id === examId);
  const classOptions = useMemo(
    () => (selectedExam?.classId ? classes.filter((row) => row._id === selectedExam.classId) : classes),
    [classes, selectedExam],
  );
  const sectionOptions = useMemo(
    () => sections.filter((row) => !classId || row.classId === classId),
    [sections, classId],
  );

  async function handleDownload() {
    setError("");
    if (!examId) {
      setError("Select an exam before downloading the template.");
      return;
    }
    setBusy("Preparing template…");
    try {
      const params = new URLSearchParams({ examId });
      if (classId) params.set("classId", classId);
      if (sectionId) params.set("sectionId", sectionId);
      await downloadTemplate(`/api/marks/bulk/template?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the template.");
    } finally {
      setBusy("");
    }
  }

  async function handleValidate() {
    setError("");
    setResult(null);
    if (!examId) {
      setError("Select the exam that this Excel belongs to.");
      return;
    }
    if (!file) {
      setError("Choose an Excel file to validate.");
      return;
    }
    setBusy("Validating Excel…");
    try {
      const body = new FormData();
      body.append("examId", examId);
      body.append("file", file);
      const response = await fetch("/api/marks/bulk/validate", { method: "POST", body, credentials: "include" });
      const data = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(data.error || "Validation failed.");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setBusy("");
    }
  }

  async function handleImport() {
    if (!preview?.importRows.length || !examId) return;
    setError("");
    setBusy(`Importing ${preview.importRows.length} student records…`);
    try {
      const response = await fetch("/api/marks/bulk/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, rows: preview.importRows }),
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setResult(data);
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy("");
    }
  }

  function resetUpload() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold gs-heading">Bulk Marks Upload</h2>
            <p className="text-sm gs-muted">Download a student template, enter gained marks, then validate before import.</p>
          </div>
          <button type="button" className="rounded-lg border px-3 py-1.5 text-sm gs-tab" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <div className="rounded-lg border gs-border bg-slate-50 p-4 text-sm">
            <p className="mb-2 font-medium">Instructions</p>
            <ol className="list-decimal space-y-1 pl-5 gs-muted">
              <li>Select the Exam.</li>
              <li>Select Class and Section if you want a class-wise student list, or leave them blank for all applicable classes.</li>
              <li>Download the Excel template.</li>
              <li>Enter subject-wise gained marks. One student occupies one row.</li>
              <li>Do not modify Student Name, Class or Section if the template is pre-populated.</li>
              <li>Do not change column headers.</li>
              <li>Do not enter Percentage or Rating.</li>
              <li>Save the Excel file as .xlsx.</li>
              <li>Upload the file, review validation errors, then confirm import.</li>
            </ol>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              Exam Name
              <select
                className="gs-input mt-1"
                value={examId}
                onChange={(e) => {
                  const exam = exams.find((row) => row._id === e.target.value);
                  setExamId(e.target.value);
                  setClassId(exam?.classId || "");
                  setSectionId("");
                  resetUpload();
                }}
              >
                <option value="">Select Exam</option>
                {exams.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Class Name
              <select
                className="gs-input mt-1"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                }}
              >
                <option value="">All classes</option>
                {classOptions.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Section
              <select className="gs-input mt-1" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">All sections</option>
                {sectionOptions.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={Boolean(busy)} onClick={() => void handleDownload()}>
              Download Student Marks Template
            </button>
            <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={() => fileRef.current?.click()}>
              Choose Excel File
            </button>
            <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={Boolean(busy)} onClick={() => void handleValidate()}>
              Validate & Preview
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
            />
          </div>
          {file ? <p className="text-sm gs-muted">Selected file: {file.name}</p> : null}

          {busy ? (
            <div className="rounded-lg border gs-border bg-blue-50 px-4 py-3 text-sm text-blue-800">{busy}</div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {preview && !result ? (
            <div className="space-y-3">
              <h3 className="font-semibold gs-heading">Bulk Marks Upload Preview</h3>
              <p className="text-sm">
                Exam: <strong>{preview.examName}</strong>
              </p>
              <p className="text-sm">
                Total Rows: {preview.totalRows} · Valid Rows: {preview.validRows} · Invalid Rows: {preview.invalidRows}
                {preview.updateRows ? ` · Existing marks to update: ${preview.updateRows}` : ""}
              </p>
              {preview.validRows ? (
                <p className="text-sm text-emerald-700">{preview.validRows} records ready to import.</p>
              ) : null}

              {preview.updates.length ? (
                <div className="overflow-x-auto rounded-lg border gs-border">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 text-left">
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">Student</th>
                        <th className="p-2">Subject</th>
                        <th className="p-2">Existing</th>
                        <th className="p-2">New</th>
                        <th className="p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.updates.slice(0, 20).map((item) => (
                        <tr key={`${item.excelRow}-${item.subjectName}`} className="border-t">
                          <td className="p-2">{item.excelRow}</td>
                          <td className="p-2">{item.studentName}</td>
                          <td className="p-2">{item.subjectName}</td>
                          <td className="p-2">{item.existingGained}</td>
                          <td className="p-2">{item.newGained}</td>
                          <td className="p-2">Update</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.updates.length > 20 ? (
                    <p className="p-2 text-xs gs-muted">Showing first 20 updates. Import will update all existing marks listed in the file.</p>
                  ) : null}
                </div>
              ) : null}

              {preview.errors.length ? (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                  {preview.errors.slice(0, 40).map((item, index) => (
                    <div key={`${item.excelRow}-${index}`} className="mb-2">
                      <p>
                        <strong>Row {item.excelRow}</strong>
                        {item.studentName ? ` · Student: ${item.studentName}` : ""}
                        {item.subjectName ? ` · Subject: ${item.subjectName}` : ""}
                      </p>
                      <p>Error: {item.message}</p>
                    </div>
                  ))}
                  {preview.errors.length > 40 ? <p>{preview.errors.length - 40} more errors are in the error report.</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <h3 className="font-semibold text-emerald-900">Bulk Marks Upload Completed</h3>
              <p>Total Rows: {result.totalRows}</p>
              <p>Successfully Imported: {result.imported}</p>
              <p>Created subject records: {result.created}</p>
              <p>Updated: {result.updated}</p>
              <p>Failed: {result.failed}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {preview?.errorReport || result?.errorReport ? (
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm gs-tab"
              onClick={() => downloadText(preview?.errorReport || result?.errorReport || "", "marks-import-errors.txt")}
            >
              Download Error Report
            </button>
          ) : null}
          {result ? (
            <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={resetUpload}>
              Upload Another File
            </button>
          ) : null}
          {result ? (
            <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={onClose}>
              View Marks
            </button>
          ) : null}
          {!result && preview?.validRows ? (
            <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={Boolean(busy)} onClick={() => void handleImport()}>
              Import {preview.validRows} Valid Records
            </button>
          ) : null}
          <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
