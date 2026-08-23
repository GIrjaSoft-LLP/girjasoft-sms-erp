import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import {
  getAttendanceRegisterReport,
  registerRowsForExport,
} from "@/lib/attendance/register";
import { excelFileResponse, rowsToExcelBuffer } from "@/lib/excel";
import { Workspace } from "@/models/platform";

function parseFilters(url: URL) {
  return {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    academicSessionId: url.searchParams.get("academicSessionId") ?? undefined,
    classId: url.searchParams.get("classId") ?? undefined,
    sectionId: url.searchParams.get("sectionId") ?? undefined,
    subjectId: url.searchParams.get("subjectId") ?? undefined,
    studentId: url.searchParams.get("studentId") ?? undefined,
  };
}

function csvResponse(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length) {
    const body = "No records";
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.view");
    const url = new URL(request.url);
    const filters = parseFilters(url);
    const report = await getAttendanceRegisterReport(ctx, filters);
    const format = url.searchParams.get("format")?.toLowerCase();

    if (format === "csv" || format === "xlsx") {
      const exportRows = registerRowsForExport(report);
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        return csvResponse(exportRows, `attendance-register-${stamp}.csv`);
      }
      const headers = exportRows.length ? Object.keys(exportRows[0]) : ["Date"];
      const buffer = await rowsToExcelBuffer("Attendance Register", headers, exportRows);
      return excelFileResponse(buffer, `attendance-register-${stamp}.xlsx`);
    }

    if (format === "pdf") {
      const workspace = await Workspace.findById(ctx.workspaceId).select("schoolName name").lean();
      const schoolName = workspace?.schoolName || workspace?.name || "School";
      const html = buildPrintHtml(schoolName, report);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return json(report);
  } catch (error) {
    return errorResponse(error);
  }
}

function buildPrintHtml(schoolName: string, report: Awaited<ReturnType<typeof getAttendanceRegisterReport>>) {
  const summary = report.summary;
  const classRows = report.classSummary
    .map(
      (row) =>
        `<tr><td>${row.className}</td><td>${row.sectionName}</td><td>${row.students}</td><td>${row.present}</td><td>${row.absent}</td><td>${row.late}</td><td>${row.leave}</td><td>${row.percentage}%</td></tr>`,
    )
    .join("");
  const detailRows = report.records
    .map(
      (row) =>
        `<tr><td>${row.date}</td><td>${row.className}</td><td>${row.sectionName}</td><td>${row.subjectName}</td><td>${row.studentName}</td><td>${row.admissionNumber}</td><td>${row.status}</td><td>${row.markedBy}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance Register</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#12203a}h1,h2{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}th,td{border:1px solid #d7e0ee;padding:6px 8px;text-align:left}th{background:#f3f6fb}.meta{font-size:13px;color:#64748b;margin-bottom:12px}</style>
</head><body onload="window.print()">
<h1>Attendance Register</h1>
<p class="meta">${schoolName}</p>
<p class="meta">Session: ${report.meta.academicSessionName} · Class: ${report.meta.className} · Section: ${report.meta.sectionName} · Subject: ${report.meta.subjectName}</p>
<p class="meta">Date Range: ${report.meta.from || "—"} to ${report.meta.to || "—"}</p>
<h2>Summary</h2>
<p>Students: ${summary.totalStudents} · Records: ${summary.totalRecords} · Present: ${summary.present} · Absent: ${summary.absent} · Late: ${summary.late} · Leave: ${summary.leave} · Attendance: ${summary.percentage}%</p>
<h2>Class-wise Summary</h2>
<table><thead><tr><th>Class</th><th>Section</th><th>Students</th><th>Present</th><th>Absent</th><th>Late</th><th>Leave</th><th>Attendance %</th></tr></thead><tbody>${classRows || "<tr><td colspan='8'>No records</td></tr>"}</tbody></table>
<h2>Detailed Attendance</h2>
<table><thead><tr><th>Date</th><th>Class</th><th>Section</th><th>Subject</th><th>Student</th><th>Admission No</th><th>Status</th><th>Marked By</th></tr></thead><tbody>${detailRows || "<tr><td colspan='8'>No records</td></tr>"}</tbody></table>
</body></html>`;
}
