"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { STUDENT_MASTER_STATUSES } from "@/config/promotion";
import { api } from "@/lib/client";

type EditPayload = {
  student: {
    _id: string;
    admissionNumber: string;
    name: string;
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    bloodGroup: string;
    aadhaar: string;
    nationality: string;
    religion: string;
    category: string;
    motherTongue: string;
    phone: string;
    email: string;
    address: string;
    emergencyContact: string;
    emergencyPhone: string;
    status: string;
    classId: string;
    sectionId: string;
    currentEnrollment: { rollNumber: string } | null;
  };
  parent: {
    name: string;
    email: string;
    phone: string;
    relation: string;
    address: string;
  } | null;
};

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<EditPayload | null>(null);
  const [classes, setClasses] = useState<Array<{ _id: string; name: string }>>([]);
  const [sections, setSections] = useState<Array<{ _id: string; name: string; classId: string }>>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [rollNumber, setRollNumber] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<EditPayload>(`/api/student-info/students/${params.id}`),
      api<{ items: Array<{ _id: string; name: string }> }>("/api/classes"),
      api<{ items: Array<{ _id: string; name: string; classId: string }> }>("/api/sections"),
    ]).then(([profile, classData, sectionData]) => {
      setData(profile);
      setClasses(classData.items);
      setSections(sectionData.items);
      setForm({
        name: profile.student.name,
        firstName: profile.student.firstName,
        middleName: profile.student.middleName,
        lastName: profile.student.lastName,
        gender: profile.student.gender,
        dateOfBirth: profile.student.dateOfBirth,
        bloodGroup: profile.student.bloodGroup,
        aadhaar: profile.student.aadhaar,
        nationality: profile.student.nationality,
        religion: profile.student.religion,
        category: profile.student.category,
        motherTongue: profile.student.motherTongue,
        phone: profile.student.phone,
        email: profile.student.email,
        address: profile.student.address,
        emergencyContact: profile.student.emergencyContact,
        emergencyPhone: profile.student.emergencyPhone,
        status: profile.student.status,
        classId: profile.student.classId,
        sectionId: profile.student.sectionId,
      });
      setRollNumber(profile.student.currentEnrollment?.rollNumber ?? "");
    });
  }, [params.id]);

  const sectionOptions = useMemo(
    () => sections.filter((item) => item.classId === form.classId),
    [form.classId, sections],
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api(`/api/student-info/students/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          rollNumber,
          reason,
          parent: data?.parent
            ? {
                name: data.parent.name,
                email: data.parent.email,
                phone: data.parent.phone,
                relation: data.parent.relation,
                address: data.parent.address,
              }
            : undefined,
        }),
      });
      setMessage("Student updated successfully.");
      router.push(`/modules/student-info/students/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  if (!data) return <div className="gs-card p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Edit Student</h2>
          <p className="text-sm text-slate-600">{data.student.admissionNumber}</p>
        </div>
        <Link href={`/modules/student-info/students/${params.id}`} className="text-sm text-[#4c7eff] hover:underline">
          Cancel
        </Link>
      </div>

      <div className="gs-card grid gap-4 p-4 md:grid-cols-2">
        <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
        <Field label="Middle Name" value={form.middleName} onChange={(v) => setForm({ ...form, middleName: v })} />
        <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
        <Field label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
        <Field label="Date of Birth" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} type="date" />
        <Field label="Blood Group" value={form.bloodGroup} onChange={(v) => setForm({ ...form, bloodGroup: v })} />
        <Field label="Aadhaar / ID" value={form.aadhaar} onChange={(v) => setForm({ ...form, aadhaar: v })} />
        <Field label="Nationality" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} />
        <Field label="Religion" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} />
        <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
        <Field label="Mother Tongue" value={form.motherTongue} onChange={(v) => setForm({ ...form, motherTongue: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Emergency Contact" value={form.emergencyContact} onChange={(v) => setForm({ ...form, emergencyContact: v })} />
        <Field label="Emergency Phone" value={form.emergencyPhone} onChange={(v) => setForm({ ...form, emergencyPhone: v })} />
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-slate-600">Address</span>
          <textarea className="gs-input min-h-24 w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Status</span>
          <select className="gs-input w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STUDENT_MASTER_STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="gs-card grid gap-4 p-4 md:grid-cols-2">
        <h3 className="md:col-span-2 font-semibold">Current Academic Assignment</h3>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Class</span>
          <select className="gs-input w-full" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, sectionId: "" })}>
            <option value="">Select Class</option>
            {classes.map((item) => (
              <option key={item._id} value={item._id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Section</span>
          <select className="gs-input w-full" value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
            <option value="">Select Section</option>
            {sectionOptions.map((item) => (
              <option key={item._id} value={item._id}>{item.name}</option>
            ))}
          </select>
        </label>
        <Field label="Roll Number" value={rollNumber} onChange={setRollNumber} />
        <Field label="Reason for class/section change" value={reason} onChange={setReason} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <button type="submit" className="gs-btn-primary">Save Student</button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input className="gs-input w-full" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
