"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS } from "@/config/admissions";
import { api } from "@/lib/client";

type Lookup = { _id: string; name: string };
type Duplicate = { id: string; type: string; label: string; studentName: string; status: string };
type DocumentRow = {
  key: string;
  name: string;
  mandatory: boolean;
  url?: string;
  status: string;
  remarks?: string;
};

type Application = {
  _id?: string;
  applicationNumber?: string;
  status?: string;
  type?: string;
  academicSessionId?: string;
  applyingClassId?: string;
  student?: Record<string, string>;
  father?: Record<string, string>;
  mother?: Record<string, string>;
  permanentAddress?: Record<string, string>;
  currentAddress?: Record<string, string>;
  sameAsPermanent?: boolean;
  previousSchoolInfo?: Record<string, string>;
  documents?: DocumentRow[];
  fees?: Record<string, number>;
  paymentRecords?: Array<Record<string, unknown>>;
  workflowHistory?: Array<Record<string, unknown>>;
  admissionNumber?: string;
  convertedStudentId?: string;
};

const STEPS = ["Student", "Parents", "Address", "Previous School", "Documents", "Fees & Actions"];

function field(label: string, value: string, onChange: (v: string) => void, required = false) {
  return (
    <label className="text-sm">
      {label}
      <input className="gs-input mt-1" required={required} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function AdmissionApplicationForm({
  applicationId,
  direct = false,
}: {
  applicationId?: string;
  direct?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [app, setApp] = useState<Application>({
    student: {},
    father: {},
    mother: {},
    permanentAddress: {},
    currentAddress: {},
    previousSchoolInfo: {},
    sameAsPermanent: false,
  });
  const [classes, setClasses] = useState<Lookup[]>([]);
  const [sessions, setSessions] = useState<Lookup[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [loading, setLoading] = useState(!!applicationId);

  useEffect(() => {
    Promise.all([
      api<{ items: Lookup[] }>("/api/classes").catch(() => ({ items: [] })),
      api<{ items: Lookup[] }>("/api/academicSessions").catch(() => ({ items: [] })),
    ]).then(([c, s]) => {
      setClasses(c.items);
      setSessions(s.items);
    });
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    api<{ item: Application }>(`/api/admissions/applications/${applicationId}`)
      .then((data) => setApp(data.item))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [applicationId]);

  function setStudent(key: string, value: string) {
    setApp((a) => ({ ...a, student: { ...a.student, [key]: value } }));
  }
  function setFather(key: string, value: string) {
    setApp((a) => ({ ...a, father: { ...a.father, [key]: value } }));
  }
  function setMother(key: string, value: string) {
    setApp((a) => ({ ...a, mother: { ...a.mother, [key]: value } }));
  }
  function setPerm(key: string, value: string) {
    setApp((a) => ({ ...a, permanentAddress: { ...a.permanentAddress, [key]: value } }));
  }
  function setCurr(key: string, value: string) {
    setApp((a) => ({ ...a, currentAddress: { ...a.currentAddress, [key]: value } }));
  }
  function setPrev(key: string, value: string) {
    setApp((a) => ({ ...a, previousSchoolInfo: { ...a.previousSchoolInfo, [key]: value } }));
  }

  async function saveDraft() {
    setError("");
    setMessage("");
    const payload = {
      type: direct ? "DIRECT" : "APPLICATION",
      academicSessionId: app.academicSessionId,
      applyingClassId: app.applyingClassId,
      student: app.student,
      father: app.father,
      mother: app.mother,
      permanentAddress: app.permanentAddress,
      currentAddress: app.sameAsPermanent ? app.permanentAddress : app.currentAddress,
      sameAsPermanent: app.sameAsPermanent,
      previousSchoolInfo: app.previousSchoolInfo,
      duplicateWarningAcknowledged: duplicates.length > 0,
      status: "DRAFT",
    };
    try {
      if (applicationId) {
        await api(`/api/admissions/applications/${applicationId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Draft saved.");
      } else {
        const data = await api<{ item: Application; duplicates?: Duplicate[]; requiresAcknowledgement?: boolean }>(
          "/api/admissions/applications",
          { method: "POST", body: JSON.stringify(payload) },
        );
        if (data.requiresAcknowledgement && data.duplicates?.length) {
          setDuplicates(data.duplicates);
          setError("Possible duplicate found. Review matches and save again to continue.");
          return;
        }
        if (data.duplicates?.length) setDuplicates(data.duplicates);
        router.replace(`/modules/admissions/applications/${data.item._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    if (!applicationId) {
      setError("Save the application first.");
      return;
    }
    setError("");
    try {
      const data = await api<{ item: Application; parentCredentials?: { username: string; temporaryPassword?: string } }>(
        `/api/admissions/applications/${applicationId}/actions`,
        { method: "POST", body: JSON.stringify({ action, ...extra }) },
      );
      setApp(data.item);
      if (data.parentCredentials?.temporaryPassword) {
        setMessage(`Student created. Parent login: ${data.parentCredentials.username} / ${data.parentCredentials.temporaryPassword}`);
      } else {
        setMessage(`Action "${action}" completed.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function uploadDocument(key: string, file: File) {
    if (!applicationId) {
      setError("Save the application before uploading documents.");
      return;
    }
    const body = new FormData();
    body.append("key", key);
    body.append("file", file);
    const response = await fetch(`/api/admissions/applications/${applicationId}/documents`, { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed");
    setApp(data.item);
    setMessage("Document uploaded.");
  }

  async function verifyDocument(key: string, status: string) {
    if (!applicationId) return;
    const data = await api<{ item: Application }>(`/api/admissions/applications/${applicationId}/documents`, {
      method: "PATCH",
      body: JSON.stringify({ key, status }),
    });
    setApp(data.item);
  }

  if (loading) return <p className="text-slate-500">Loading application…</p>;

  const student = app.student ?? {};
  const father = app.father ?? {};
  const mother = app.mother ?? {};
  const perm = app.permanentAddress ?? {};
  const curr = app.currentAddress ?? {};
  const prev = app.previousSchoolInfo ?? {};
  const fees = app.fees ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm ${step === index ? "bg-[#4c7eff] text-white" : "bg-white border border-slate-200"}`}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {app.applicationNumber ? (
        <p className="text-sm text-slate-600">
          Application <strong>{app.applicationNumber}</strong> · Status: <strong>{app.status?.replace(/_/g, " ")}</strong>
          {app.admissionNumber ? ` · Admission No. ${app.admissionNumber}` : ""}
        </p>
      ) : null}

      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        {step === 0 ? (
          <>
            <h2 className="md:col-span-2 font-semibold">Student Information</h2>
            <label className="text-sm">
              Academic Session
              <select className="gs-input mt-1" value={app.academicSessionId ?? ""} onChange={(e) => setApp((a) => ({ ...a, academicSessionId: e.target.value }))}>
                <option value="">Select session</option>
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Applying Class
              <select className="gs-input mt-1" value={app.applyingClassId ?? ""} onChange={(e) => setApp((a) => ({ ...a, applyingClassId: e.target.value }))}>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>
            {field("Full Name", student.name ?? "", (v) => setStudent("name", v), true)}
            {field("First Name", student.firstName ?? "", (v) => setStudent("firstName", v))}
            {field("Middle Name", student.middleName ?? "", (v) => setStudent("middleName", v))}
            {field("Last Name", student.lastName ?? "", (v) => setStudent("lastName", v))}
            {field("Date of Birth", student.dateOfBirth ?? "", (v) => setStudent("dateOfBirth", v))}
            {field("Gender", student.gender ?? "", (v) => setStudent("gender", v))}
            {field("Blood Group", student.bloodGroup ?? "", (v) => setStudent("bloodGroup", v))}
            {field("Aadhaar / ID", student.aadhaar ?? "", (v) => setStudent("aadhaar", v))}
            {field("Nationality", student.nationality ?? "Indian", (v) => setStudent("nationality", v))}
            {field("Religion", student.religion ?? "", (v) => setStudent("religion", v))}
            {field("Category", student.category ?? "", (v) => setStudent("category", v))}
            {field("Mother Tongue", student.motherTongue ?? "", (v) => setStudent("motherTongue", v))}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="md:col-span-2 font-semibold">Father</h2>
            {field("Name", father.name ?? "", (v) => setFather("name", v))}
            {field("Mobile", father.mobile ?? "", (v) => setFather("mobile", v))}
            {field("Email", father.email ?? "", (v) => setFather("email", v))}
            {field("Occupation", father.occupation ?? "", (v) => setFather("occupation", v))}
            {field("Company", father.company ?? "", (v) => setFather("company", v))}
            {field("Designation", father.designation ?? "", (v) => setFather("designation", v))}
            <h2 className="md:col-span-2 font-semibold">Mother</h2>
            {field("Name", mother.name ?? "", (v) => setMother("name", v))}
            {field("Mobile", mother.mobile ?? "", (v) => setMother("mobile", v))}
            {field("Email", mother.email ?? "", (v) => setMother("email", v))}
            {field("Occupation", mother.occupation ?? "", (v) => setMother("occupation", v))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="md:col-span-2 font-semibold">Permanent Address</h2>
            {field("Address", perm.address ?? "", (v) => setPerm("address", v))}
            {field("City", perm.city ?? "", (v) => setPerm("city", v))}
            {field("State", perm.state ?? "", (v) => setPerm("state", v))}
            {field("Country", perm.country ?? "India", (v) => setPerm("country", v))}
            {field("PIN Code", perm.pinCode ?? "", (v) => setPerm("pinCode", v))}
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={app.sameAsPermanent ?? false}
                onChange={(e) => setApp((a) => ({ ...a, sameAsPermanent: e.target.checked, currentAddress: e.target.checked ? a.permanentAddress : a.currentAddress }))}
              />
              Current address same as permanent address
            </label>
            {!app.sameAsPermanent ? (
              <>
                <h2 className="md:col-span-2 font-semibold">Current Address</h2>
                {field("Address", curr.address ?? "", (v) => setCurr("address", v))}
                {field("City", curr.city ?? "", (v) => setCurr("city", v))}
                {field("State", curr.state ?? "", (v) => setCurr("state", v))}
                {field("Country", curr.country ?? "India", (v) => setCurr("country", v))}
                {field("PIN Code", curr.pinCode ?? "", (v) => setCurr("pinCode", v))}
              </>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="md:col-span-2 font-semibold">Previous School</h2>
            {field("School Name", prev.schoolName ?? "", (v) => setPrev("schoolName", v))}
            {field("Board", prev.board ?? "", (v) => setPrev("board", v))}
            {field("Address", prev.address ?? "", (v) => setPrev("address", v))}
            {field("Previous Class", prev.previousClass ?? "", (v) => setPrev("previousClass", v))}
            {field("Last Academic Session", prev.lastAcademicSession ?? "", (v) => setPrev("lastAcademicSession", v))}
            {field("TC Number", prev.tcNumber ?? "", (v) => setPrev("tcNumber", v))}
            {field("TC Date", prev.tcDate ?? "", (v) => setPrev("tcDate", v))}
            {field("Previous Roll Number", prev.previousRollNumber ?? "", (v) => setPrev("previousRollNumber", v))}
            {field("Previous Result", prev.previousResult ?? "", (v) => setPrev("previousResult", v))}
            {field("Reason for Leaving", prev.reasonForLeaving ?? "", (v) => setPrev("reasonForLeaving", v))}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="md:col-span-2 font-semibold">Documents</h2>
            {(app.documents ?? []).map((doc) => (
              <div key={doc.key} className="md:col-span-2 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {doc.name} {doc.mandatory ? "*" : ""}
                    </p>
                    <p className="text-xs text-slate-500">Status: {doc.status.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-[#4c7eff]">
                        Preview
                      </a>
                    ) : null}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadDocument(doc.key, file).catch((err) => setError(err.message));
                      }}
                    />
                    {applicationId ? (
                      <>
                        <button type="button" className="text-sm text-emerald-700" onClick={() => verifyDocument(doc.key, "VERIFIED").catch((err) => setError(err.message))}>
                          Verify
                        </button>
                        <button type="button" className="text-sm text-red-700" onClick={() => verifyDocument(doc.key, "REJECTED").catch((err) => setError(err.message))}>
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2 className="md:col-span-2 font-semibold">Fees & Workflow</h2>
            <div className="md:col-span-2 grid sm:grid-cols-3 gap-2 text-sm">
              <p>Gross: ₹{fees.gross ?? 0}</p>
              <p>Discount: ₹{fees.discount ?? 0}</p>
              <p>Net: ₹{fees.net ?? 0}</p>
              <p>Paid: ₹{fees.paid ?? 0}</p>
              <p>Due: ₹{fees.due ?? 0}</p>
            </div>
            {applicationId ? (
              <div className="md:col-span-2 flex flex-wrap gap-2 items-end">
                <label className="text-sm">
                  Payment Amount
                  <input className="gs-input mt-1" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </label>
                <label className="text-sm">
                  Method
                  <select className="gs-input mt-1" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="gs-btn px-3 py-2 text-sm" onClick={() => runAction("payment", { amount: Number(paymentAmount), method: paymentMethod })}>
                  Collect Payment
                </button>
                <button type="button" className="gs-btn px-3 py-2 text-sm" onClick={() => runAction("submit")}>Submit</button>
                <button type="button" className="gs-btn px-3 py-2 text-sm" onClick={() => runAction("approve")}>Approve</button>
                <button type="button" className="gs-btn px-3 py-2 text-sm" onClick={() => runAction("confirm")}>Confirm & Create Student</button>
                <button type="button" className="gs-btn px-3 py-2 text-sm bg-white border border-slate-200" onClick={() => runAction("reject", { remarks: "Rejected" })}>Reject</button>
              </div>
            ) : null}
            {(app.workflowHistory ?? []).length ? (
              <div className="md:col-span-2">
                <h3 className="font-medium mb-2">Workflow History</h3>
                <ul className="space-y-1 text-sm text-slate-600">
                  {(app.workflowHistory ?? []).slice().reverse().map((row, i) => (
                    <li key={i}>
                      {String(row.action)} — {String(row.status)} — {String(row.userEmail ?? "")} — {row.at ? new Date(String(row.at)).toLocaleString() : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {duplicates.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Possible existing applicant found</p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((d) => (
              <li key={`${d.type}-${d.id}`}>{d.type}: {d.label} — {d.studentName} ({d.status})</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-red-600">{error}</p> : null}
      {message ? <p className="text-emerald-700">{message}</p> : null}

      <div className="flex gap-2">
        <button type="button" className="gs-btn px-4 py-2" onClick={saveDraft}>Save Draft</button>
        {step > 0 ? (
          <button type="button" className="px-4 py-2 text-sm" onClick={() => setStep((s) => s - 1)}>Previous</button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button type="button" className="px-4 py-2 text-sm" onClick={() => setStep((s) => s + 1)}>Next</button>
        ) : null}
      </div>
    </div>
  );
}
