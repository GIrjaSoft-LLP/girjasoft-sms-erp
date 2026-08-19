"use client";

import Link from "next/link";
import { StudentAttendancePanel } from "@/components/attendance/StudentAttendancePanel";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { STUDENT_PROFILE_TABS } from "@/config/student-info";
import { api } from "@/lib/client";

type ProfilePayload = {
  student: {
    _id: string;
    admissionNumber: string;
    studentCode: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    email: string;
    address: string;
    photo: string;
    status: string;
    className: string;
    sectionName: string;
    currentEnrollment: {
      academicSessionName: string;
      className: string;
      sectionName: string;
      rollNumber: string;
    } | null;
    academicHistory: Array<{
      academicSessionName: string;
      className: string;
      sectionName: string;
      rollNumber: string;
      promotionStatus: string;
      isCurrent: boolean;
    }>;
  };
  parent: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    relation: string;
    address: string;
    status: string;
    login: { username: string; email: string; status: string } | null;
    children: Array<{ _id: string; name: string; admissionNumber: string }>;
  } | null;
  enabledModuleIds: string[];
};

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-[#0b1b3a]">{value || "—"}</p>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [tab, setTab] = useState("overview");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const canEdit = permissions.includes("students.edit");

  useEffect(() => {
    setError("");
    setData(null);
    Promise.all([
      api<ProfilePayload>(`/api/student-info/students/${params.id}`),
      api<{ user: { permissions?: string[]; roleSlugs?: string[] } }>("/api/auth/me"),
    ])
      .then(([profile, me]) => {
        setData(profile);
        setPermissions(me.user.permissions ?? []);
        setRoleSlugs(me.user.roleSlugs ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load student profile.");
      });
  }, [params.id]);

  const visibleTabs = useMemo(() => {
    const enabled = new Set(data?.enabledModuleIds ?? []);
    const isParent = roleSlugs.includes("parent");
    return STUDENT_PROFILE_TABS.filter((item) => {
      if (!("permission" in item)) return true;
      const permitted =
        permissions.includes(item.permission) ||
        (isParent && item.key === "attendance" && permissions.includes("students.view"));
      if (!permitted) return false;
      if (item.moduleId && !enabled.has(item.moduleId)) return false;
      return true;
    });
  }, [data?.enabledModuleIds, permissions, roleSlugs]);

  if (error) {
    return (
      <div className="gs-card space-y-3 p-6 text-sm">
        <p className="font-semibold text-red-600">{error}</p>
        <Link href="/modules/student-info/students" className="text-[#4c7eff] hover:underline">
          Back to students
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="gs-card p-6 text-sm text-slate-500">Loading student profile…</div>;
  }

  const { student, parent } = data;
  const classLabel = [student.className, student.sectionName].filter(Boolean).join("-");

  return (
    <div className="space-y-6">
      <div className="gs-card flex flex-wrap items-start gap-4 p-5">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl bg-[#0b1b3a] text-xl font-semibold text-white">
          {student.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/students/${student._id}/photo`} alt="" className="h-full w-full object-cover" />
          ) : (
            student.name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold text-[#0b1b3a]">{student.name}</h2>
          <p className="mt-1 text-sm text-slate-600">Admission No: {student.admissionNumber}</p>
          <p className="text-sm text-slate-600">Student ID: {student.studentCode}</p>
          {classLabel ? <p className="text-sm text-slate-600">Class: {classLabel}</p> : null}
          {student.currentEnrollment ? (
            <p className="text-sm text-slate-600">
              Session: {student.currentEnrollment.academicSessionName}
              {student.currentEnrollment.rollNumber ? ` · Roll No. ${student.currentEnrollment.rollNumber}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {canEdit ? (
            <Link href={`/modules/student-info/students/${student._id}/edit`} className="text-sm text-[#4c7eff] hover:underline">
              Edit Student
            </Link>
          ) : null}
          <Link href="/modules/student-info/students" className="text-sm text-[#4c7eff] hover:underline">
            Back to students
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-3 py-2 text-sm ${
              tab === item.key ? "bg-[#4c7eff] text-white" : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="gs-card space-y-3 p-4">
            <h3 className="font-semibold">Student Summary</h3>
            <ProfileField label="Status" value={student.status} />
            <ProfileField label="Gender" value={student.gender} />
            <ProfileField label="Date of Birth" value={student.dateOfBirth} />
            <ProfileField label="Phone" value={student.phone} />
            <ProfileField label="Email" value={student.email} />
          </div>
          <div className="gs-card space-y-3 p-4">
            <h3 className="font-semibold">Linked Modules</h3>
            <p className="text-sm text-slate-600">
              Attendance, fees, examination, homework, transport and library data are linked to this student through
              the central Student record.
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              {visibleTabs
                .filter((item) => ["attendance", "fees", "examination", "homework", "transport", "library"].includes(item.key))
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "personal" ? (
        <div className="gs-card grid gap-4 p-4 md:grid-cols-2">
          <ProfileField label="Name" value={student.name} />
          <ProfileField label="Gender" value={student.gender} />
          <ProfileField label="Date of Birth" value={student.dateOfBirth} />
          <ProfileField label="Phone" value={student.phone} />
          <ProfileField label="Email" value={student.email} />
          <ProfileField label="Address" value={student.address} />
        </div>
      ) : null}

      {tab === "academic" ? (
        <div className="space-y-4">
          <div className="gs-card grid gap-4 p-4 md:grid-cols-2">
            <ProfileField label="Current Academic Session" value={student.currentEnrollment?.academicSessionName ?? ""} />
            <ProfileField label="Current Class" value={student.currentEnrollment?.className ?? student.className} />
            <ProfileField label="Current Section" value={student.currentEnrollment?.sectionName ?? student.sectionName} />
            <ProfileField label="Current Roll Number" value={student.currentEnrollment?.rollNumber ?? ""} />
            <ProfileField label="Admission Number" value={student.admissionNumber} />
            <ProfileField label="Status" value={student.status} />
          </div>
          <div className="gs-card overflow-x-auto p-4">
            <h3 className="mb-3 font-semibold">Academic History</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="p-2">Session</th>
                  <th className="p-2">Class</th>
                  <th className="p-2">Section</th>
                  <th className="p-2">Roll No.</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {student.academicHistory.map((row) => (
                  <tr key={`${row.academicSessionName}-${row.className}-${row.sectionName}`} className="border-b">
                    <td className="p-2">{row.academicSessionName}</td>
                    <td className="p-2">{row.className}</td>
                    <td className="p-2">{row.sectionName}</td>
                    <td className="p-2">{row.rollNumber || "—"}</td>
                    <td className="p-2">{row.promotionStatus}{row.isCurrent ? " (Current)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "parents" ? (
        <div className="space-y-4">
          {parent ? (
            <>
              <div className="gs-card grid gap-4 p-4 md:grid-cols-2">
                <ProfileField label="Parent / Guardian" value={parent.name} />
                <ProfileField label="Relation" value={parent.relation} />
                <ProfileField label="Mobile" value={parent.phone} />
                <ProfileField label="Email" value={parent.email} />
                <ProfileField label="Address" value={parent.address} />
                <ProfileField label="Login Username" value={parent.login?.username ?? "Not created"} />
                <ProfileField label="Account Status" value={parent.login?.status ?? "—"} />
              </div>
              {parent.children.length > 1 ? (
                <div className="gs-card p-4">
                  <h3 className="mb-3 font-semibold">Linked Children</h3>
                  <ul className="space-y-2 text-sm">
                    {parent.children.map((child) => (
                      <li key={child._id}>
                        <Link href={`/modules/student-info/students/${child._id}`} className="text-[#4c7eff] hover:underline">
                          {child.name} ({child.admissionNumber})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link href="/modules/student-info/parents" className="text-sm text-[#4c7eff] hover:underline">
                Manage parents / guardians
              </Link>
            </>
          ) : (
            <div className="gs-card p-4 text-sm text-slate-500">No parent/guardian linked to this student.</div>
          )}
        </div>
      ) : null}

      {tab === "attendance" ? <StudentAttendancePanel studentId={student._id} /> : null}

      {tab === "fees" ? (
        <ModuleLinkPanel
          title="Fees"
          description="View fee assignments and payment history for this student."
          href={`/finance/fees?studentId=${student._id}`}
        />
      ) : null}

      {tab === "examination" ? (
        <ModuleLinkPanel
          title="Examination"
          description="View exams, marks and results linked to this student."
          href={`/modules/marks?studentId=${student._id}`}
        />
      ) : null}

      {tab === "homework" ? (
        <ModuleLinkPanel
          title="Homework"
          description="View homework assigned to this student's class."
          href={`/modules/homework?studentId=${student._id}`}
        />
      ) : null}

      {tab === "transport" ? (
        <ModuleLinkPanel
          title="Transport"
          description="View transport assignment for this student."
          href={`/modules/transport?studentId=${student._id}`}
        />
      ) : null}

      {tab === "library" ? (
        <ModuleLinkPanel
          title="Library"
          description="View library issues linked to this student."
          href={`/modules/bookIssues?studentId=${student._id}`}
        />
      ) : null}
    </div>
  );
}

function ModuleLinkPanel({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="gs-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Link href={href} className="mt-3 inline-block text-sm text-[#4c7eff] hover:underline">
        Open {title}
      </Link>
    </div>
  );
}
