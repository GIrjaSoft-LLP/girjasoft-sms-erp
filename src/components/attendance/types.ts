import type { AttendanceFilterType } from "@/lib/attendance/filters";

export type AttendanceFilterState = {
  filterType: AttendanceFilterType;
  date?: string;
  weekStart?: string;
  month?: string;
  academicSessionId?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  subjectId?: string;
};

export type AttendanceSummaryData = {
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
};

export type AttendanceRecordItem = {
  date: string;
  studentId?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  status: string;
  attendanceType: string;
  subjectName: string;
  remarks: string;
};

export type SubjectAttendanceItem = {
  subjectId?: string;
  subjectName: string;
  subjectCode: string;
  workingDays: number;
  present: number;
  absent: number;
  late?: number;
  leave?: number;
  percentage: number;
};

export type DailyBreakdownItem = {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
};

export type LinkedChildItem = {
  _id: string;
  name: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  academicSessionName?: string;
};

export type ScopeOptions = {
  academicSessions: Array<{ _id: string; name: string; isCurrent?: boolean }>;
  classes: Array<{ _id: string; name: string }>;
  sections: Array<{ _id: string; name: string; classId: string }>;
  subjects: Array<{ _id: string; name: string; code: string; classId: string }>;
  students: Array<{
    _id: string;
    name: string;
    admissionNumber: string;
    classId: string;
    sectionId: string;
    academicSessionId: string;
  }>;
};

export type AttendanceViewPayload = {
  role: "admin" | "teacher" | "parent" | "student";
  filter: {
    filterType: AttendanceFilterType;
    from: string;
    to: string;
    label: string;
    date?: string;
    weekStart?: string;
    month?: string;
  };
  student?: {
    _id: string;
    name: string;
    admissionNumber: string;
    className?: string;
    sectionName?: string;
  };
  classSummary: AttendanceSummaryData;
  subjectWise: SubjectAttendanceItem[];
  dailyBreakdown: DailyBreakdownItem[];
  records: AttendanceRecordItem[];
  children?: LinkedChildItem[];
  activeStudentId?: string;
  scopeOptions?: ScopeOptions;
  defaults?: {
    filter: { filterType: AttendanceFilterType; month?: string };
    academicSessionId: string;
  };
};

export function filterStateToParams(state: AttendanceFilterState) {
  const params = new URLSearchParams();
  params.set("filterType", state.filterType);
  if (state.date) params.set("date", state.date);
  if (state.weekStart) params.set("weekStart", state.weekStart);
  if (state.month) params.set("month", state.month);
  if (state.academicSessionId) params.set("academicSessionId", state.academicSessionId);
  if (state.classId) params.set("classId", state.classId);
  if (state.sectionId) params.set("sectionId", state.sectionId);
  if (state.studentId) params.set("studentId", state.studentId);
  if (state.subjectId) params.set("subjectId", state.subjectId);
  return params;
}
