"use client";

import { useEffect, useState, type ReactNode } from "react";

export type IdCardLetterhead = {
  schoolName: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  code?: string;
  academicSession?: string;
};

export type StudentIdCard = {
  photo?: string;
  name: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  dateOfBirth?: string;
  parentName?: string;
  phone?: string;
  academicSession?: string;
};

export type TeacherIdCard = {
  photo?: string;
  name: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  joiningDate?: string;
  academicSession?: string;
};

function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="grid h-28 w-24 place-items-center bg-[#0b1b3a] text-lg font-semibold text-white">
      {letters || "GS"}
    </div>
  );
}

function Portrait({ photo, name }: { photo?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [photo]);
  if (!photo || failed) return <Initials name={name} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt=""
      className="h-28 w-24 object-cover ring-1 ring-slate-200"
      onError={() => setFailed(true)}
    />
  );
}

function CardShell({
  letterhead,
  title,
  photo,
  name,
  children,
}: {
  letterhead: IdCardLetterhead;
  title: string;
  photo?: string;
  name: string;
  children: ReactNode;
}) {
  const contact = [letterhead.address, letterhead.phone, letterhead.email].filter(Boolean).join(" · ");
  return (
    <article className="id-card overflow-hidden border border-slate-300 bg-white text-[#0b1b3a]">
      <header className="flex items-center gap-2 bg-[#0b1b3a] px-3 py-2 text-white">
        {letterhead.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={letterhead.logo} alt="" className="h-10 w-10 rounded bg-white object-contain p-0.5" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{letterhead.schoolName}</p>
          {contact ? <p className="truncate text-[10px] text-blue-100">{contact}</p> : null}
        </div>
      </header>
      <div className="px-3 py-2 text-center text-[11px] font-semibold tracking-[0.18em] text-[#4c7eff]">
        {title}
      </div>
      <div className="flex justify-center pb-2">
        <Portrait photo={photo} name={name} />
      </div>
      <dl className="space-y-1 px-4 pb-3 text-xs">{children}</dl>
      <div className="mt-auto flex items-end justify-between border-t border-slate-200 px-4 py-2 text-[10px] text-slate-500">
        <span>Session {letterhead.academicSession || "—"}</span>
        <span className="text-right">
          Authorized Signature
          <span className="mt-3 block w-20 border-t border-slate-400" />
        </span>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function StudentIdentityCard({
  letterhead,
  card,
}: {
  letterhead: IdCardLetterhead;
  card: StudentIdCard;
}) {
  return (
    <CardShell letterhead={{ ...letterhead, academicSession: card.academicSession || letterhead.academicSession }} title="STUDENT ID CARD" photo={card.photo} name={card.name}>
      <Row label="Name" value={card.name} />
      <Row label="Student ID" value={card.admissionNumber} />
      <Row label="Class" value={card.className} />
      <Row label="Section" value={card.sectionName} />
      <Row label="Date of Birth" value={card.dateOfBirth} />
      <Row label="Parent" value={card.parentName} />
      <Row label="Contact" value={card.phone} />
    </CardShell>
  );
}

export function TeacherIdentityCard({
  letterhead,
  card,
}: {
  letterhead: IdCardLetterhead;
  card: TeacherIdCard;
}) {
  return (
    <CardShell letterhead={{ ...letterhead, academicSession: card.academicSession || letterhead.academicSession }} title="TEACHER ID CARD" photo={card.photo} name={card.name}>
      <Row label="Name" value={card.name} />
      <Row label="Employee ID" value={card.employeeId} />
      <Row label="Designation" value={card.designation} />
      <Row label="Department" value={card.department} />
      <Row label="Joined" value={card.joiningDate} />
      <Row label="Contact" value={card.phone || card.email} />
    </CardShell>
  );
}
