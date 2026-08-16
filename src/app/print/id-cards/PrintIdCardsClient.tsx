"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  StudentIdentityCard,
  TeacherIdentityCard,
  type IdCardLetterhead,
  type StudentIdCard,
  type TeacherIdCard,
} from "@/components/IdentityCard";
import { api } from "@/lib/client";

export default function PrintIdCardsClient() {
  const params = useSearchParams();
  const kind = params.get("kind") ?? "";
  const ids = params.get("ids") ?? "";
  const [letterhead, setLetterhead] = useState<IdCardLetterhead | null>(null);
  const [studentCards, setStudentCards] = useState<StudentIdCard[]>([]);
  const [teacherCards, setTeacherCards] = useState<TeacherIdCard[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!kind || !ids) {
      setError("Select records to print.");
      return;
    }
    api<{
      letterhead: IdCardLetterhead;
      cards: Array<StudentIdCard & TeacherIdCard>;
    }>(`/api/id-cards?kind=${encodeURIComponent(kind)}&ids=${encodeURIComponent(ids)}`)
      .then((data) => {
        setLetterhead(data.letterhead);
        if (kind === "teachers") setTeacherCards(data.cards);
        else setStudentCards(data.cards);
      })
      .catch((err) => setError(err.message));
  }, [kind, ids]);

  return (
    <div className="p-6 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <button className="gs-btn px-4 py-2" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      {letterhead ? (
        <div className="id-card-sheet">
          {kind === "teachers"
            ? teacherCards.map((card, index) => (
                <TeacherIdentityCard key={`${card.employeeId}-${index}`} letterhead={letterhead} card={card} />
              ))
            : studentCards.map((card, index) => (
                <StudentIdentityCard key={`${card.admissionNumber}-${index}`} letterhead={letterhead} card={card} />
              ))}
        </div>
      ) : !error ? (
        <p>Preparing ID cards…</p>
      ) : null}
    </div>
  );
}
