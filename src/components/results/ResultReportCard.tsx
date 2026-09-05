"use client";

import { DocumentLetterhead, type Letterhead } from "@/components/DocumentLetterhead";

export type ResultReport = {
  examName: string;
  examType?: string;
  academicSessionName?: string;
  admissionNumber?: string;
  rollNumber?: string;
  studentName: string;
  className: string;
  sectionName: string;
  rows: Array<{
    subjectName: string;
    marksObtained: number;
    maxMarks: number;
    percentage: number;
    grade?: string;
  }>;
  totalMarks: number;
  gainedMarks: number;
  percentage: number;
  rating: string;
  status: string;
  generatedAt?: string;
};

function pct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value?: string) {
  if (!value) return new Date().toLocaleDateString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="result-field">
      <span className="result-field-label">{label}</span>
      <span className="result-field-value">{value}</span>
    </div>
  );
}

export function ResultReportCard({
  item,
  letterhead,
}: {
  item: ResultReport;
  letterhead: Letterhead | null;
}) {
  return (
    <article className="result-certificate">
      <div className="result-certificate-inner">
        {letterhead ? (
          <DocumentLetterhead letterhead={letterhead} title="Examination Result" />
        ) : (
          <h2 className="result-certificate-title">Examination Result</h2>
        )}

        <section className="result-section">
          <h3 className="result-section-title">1. Student Information</h3>
          <div className="result-field-grid">
            <Field label="Student Name" value={item.studentName} />
            <Field label="Class" value={item.className || "—"} />
            <Field label="Section" value={item.sectionName || "—"} />
            <Field label="Roll Number" value={item.rollNumber || undefined} />
          </div>
        </section>

        <section className="result-section">
          <h3 className="result-section-title">2. Exam Information</h3>
          <div className="result-field-grid">
            <Field label="Exam Name" value={item.examName} />
            <Field label="Exam Session" value={item.academicSessionName || undefined} />
            <Field label="Exam Type" value={item.examType || undefined} />
          </div>
        </section>

        <section className="result-section">
          <h3 className="result-section-title">3. Marks and Result</h3>
          <table className="result-marks-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Obtained Marks</th>
                <th>Total Marks</th>
              </tr>
            </thead>
            <tbody>
              {item.rows.map((row) => (
                <tr key={row.subjectName}>
                  <td>{row.subjectName}</td>
                  <td>{row.marksObtained}</td>
                  <td>{row.maxMarks}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="result-summary">
            <h4 className="result-summary-title">Overall Summary</h4>
            <div className="result-summary-grid">
              <div>
                <span>Total Obtained Marks</span>
                <strong>{item.gainedMarks}</strong>
              </div>
              <div>
                <span>Total Marks</span>
                <strong>{item.totalMarks}</strong>
              </div>
              <div>
                <span>Percentage</span>
                <strong>{pct(item.percentage)}</strong>
              </div>
              <div>
                <span>Grade</span>
                <strong>{item.rating || "—"}</strong>
              </div>
              <div>
                <span>Pass/Fail Status</span>
                <strong className={item.status === "FAIL" ? "result-status-fail" : "result-status-pass"}>
                  {item.status || "—"}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <p className="result-generated">Generated Date: {formatDate(item.generatedAt)}</p>
      </div>
    </article>
  );
}
