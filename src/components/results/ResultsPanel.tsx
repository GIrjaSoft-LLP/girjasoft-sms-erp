"use client";

import { useCallback, useEffect, useState } from "react";
import { ResultReportCard, type ResultReport } from "@/components/results/ResultReportCard";
import type { Letterhead } from "@/components/DocumentLetterhead";
import { api } from "@/lib/client";

type ParentExam = {
  examId: string;
  examName: string;
  hasMarks: boolean;
  totalMarks: number;
  gainedMarks: number;
  percentage: number;
  rating: string;
};
type Summary = {
  examId: string;
  studentId: string;
  examName: string;
  studentName: string;
  className: string;
  sectionName: string;
  totalMarks: number;
  gainedMarks: number;
  percentage: number;
  rating: string;
};

function pct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function ResultsPanel() {
  const [mode, setMode] = useState<"admin" | "teacher" | "parent" | "student">("admin");
  const [letterhead, setLetterhead] = useState<Letterhead | null>(null);
  const [parentMeta, setParentMeta] = useState({ studentName: "", className: "", sectionName: "" });
  const [parentExams, setParentExams] = useState<ParentExam[]>([]);
  const [items, setItems] = useState<Summary[]>([]);
  const [selectedExam, setSelectedExam] = useState<ParentExam | null>(null);
  const [report, setReport] = useState<ResultReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");
  const isParent = mode === "parent" || mode === "student";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [context, brand] = await Promise.all([
        api<{ moduleContext: { mode: typeof mode } }>("/api/results/context"),
        api<{ letterhead: Letterhead }>("/api/workspace/letterhead"),
      ]);
      setMode(context.moduleContext.mode);
      setLetterhead(brand.letterhead);
      if (context.moduleContext.mode === "parent" || context.moduleContext.mode === "student") {
        const parent = await api<{
          studentName: string;
          className: string;
          sectionName: string;
          exams: ParentExam[];
        }>("/api/results/list");
        setParentMeta({
          studentName: parent.studentName,
          className: parent.className,
          sectionName: parent.sectionName,
        });
        setParentExams(parent.exams ?? []);
      } else {
        const list = await api<{ items: Summary[] }>("/api/results/list");
        setItems(list.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openReport(examId: string, studentId?: string) {
    setReportLoading(true);
    setError("");
    try {
      const suffix = studentId ? `?examId=${examId}&studentId=${studentId}` : `?examId=${examId}`;
      const data = await api<{ item: ResultReport }>(`/api/results/report${suffix}`);
      setReport(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the result.");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold gs-heading">Results</h1>
          <p className="text-sm gs-muted">
            {isParent
              ? "View examination results for the linked student."
              : "Review exam-wise student results. Marks are entered in the Marks module."}
          </p>
        </div>
        {report ? (
          <div className="text-right">
            <button type="button" className="gs-btn px-4 py-2" onClick={() => window.print()}>
              Print Result
            </button>
            <p className="mt-1 text-xs gs-muted">Use the browser print dialog to print or Save as PDF.</p>
          </div>
        ) : null}
      </div>

      {isParent ? (
        <div className="rounded-lg border gs-border bg-slate-50 px-4 py-3 text-sm print:hidden">
          Student: <strong>{parentMeta.studentName}</strong> · Class <strong>{parentMeta.className}</strong> · Section{" "}
          <strong>{parentMeta.sectionName}</strong>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}

      {report ? (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm text-[#4c7eff] hover:underline print:hidden"
            onClick={() => {
              setReport(null);
              if (isParent) setSelectedExam(null);
            }}
          >
            Back
          </button>
          {reportLoading ? <p className="text-sm gs-muted">Loading result…</p> : <ResultReportCard item={report} letterhead={letterhead} />}
        </div>
      ) : null}

      {!report && isParent ? (
        <div className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold gs-heading">Examination Results</h2>
          {selectedExam ? (
            <div className="gs-card space-y-4 p-4">
              <button type="button" className="text-sm text-[#4c7eff] hover:underline" onClick={() => setSelectedExam(null)}>
                Back to exams
              </button>
              <h3 className="text-base font-semibold gs-heading">{selectedExam.examName}</h3>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p><span className="gs-muted">Student: </span>{parentMeta.studentName}</p>
                <p><span className="gs-muted">Class: </span>{parentMeta.className}</p>
                <p><span className="gs-muted">Section: </span>{parentMeta.sectionName}</p>
              </div>
              {selectedExam.hasMarks ? (
                <>
                  <div className="rounded-lg border gs-border bg-slate-50 p-3 text-sm">
                    <p>Total Marks: <strong>{selectedExam.totalMarks}</strong></p>
                    <p>Obtained Marks: <strong>{selectedExam.gainedMarks}</strong></p>
                    <p>Percentage: <strong>{pct(selectedExam.percentage)}</strong></p>
                    <p>Grade: <strong>{selectedExam.rating || "—"}</strong></p>
                  </div>
                  <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => void openReport(selectedExam.examId)}>
                    View Result Card
                  </button>
                </>
              ) : (
                <p className="text-sm gs-muted">Result has not been published yet.</p>
              )}
            </div>
          ) : (
            <div className="gs-card divide-y">
              {loading ? <p className="p-4 text-sm gs-muted">Loading results…</p> : null}
              {!loading && !parentExams.length ? <p className="p-4 text-sm gs-muted">No exams found.</p> : null}
              {parentExams.map((exam) => (
                <button
                  key={exam.examId}
                  type="button"
                  className="flex w-full flex-col items-start gap-1 p-4 text-left hover:bg-slate-50"
                  onClick={() => setSelectedExam(exam)}
                >
                  <span className="font-medium text-[#4c7eff]">{exam.examName}</span>
                  {exam.hasMarks ? (
                    <span className="text-sm gs-muted">
                      {exam.gainedMarks}/{exam.totalMarks} · {pct(exam.percentage)} · {exam.rating}
                    </span>
                  ) : (
                    <span className="text-sm gs-muted">Result has not been published yet.</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!report && !isParent ? (
        <div className="gs-card overflow-x-auto print:hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3 font-medium">Exam</th>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Class</th>
                <th className="p-3 font-medium">Section</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Obtained</th>
                <th className="p-3 font-medium">Percentage</th>
                <th className="p-3 font-medium">Grade</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-4 text-slate-500">Loading results…</td></tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={`${item.examId}-${item.studentId}`} className="border-t border-slate-100">
                    <td className="p-3">{item.examName}</td>
                    <td className="p-3">{item.studentName}</td>
                    <td className="p-3">{item.className}</td>
                    <td className="p-3">{item.sectionName}</td>
                    <td className="p-3">{item.totalMarks}</td>
                    <td className="p-3">{item.gainedMarks}</td>
                    <td className="p-3">{pct(item.percentage)}</td>
                    <td className="p-3">{item.rating || "—"}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-[#4c7eff] hover:underline"
                        onClick={() => void openReport(item.examId, item.studentId)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} className="p-4 text-slate-500">No results recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
