"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type DashboardData = {
  stats: {
    totalEnquiries: number;
    newEnquiriesToday: number;
    followUpsPending: number;
    applicationsReceived: number;
    admissionsConfirmed: number;
    admissionsPending: number;
    conversionRate: number;
    upcomingFollowUps: number;
  };
  recentEnquiries: Record<string, unknown>[];
  recentApplications: Record<string, unknown>[];
  pendingApplications: Record<string, unknown>[];
  pendingPayments: Record<string, unknown>[];
  documentsPending: Record<string, unknown>[];
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="gs-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0b1b3a]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "CONFIRMED" || status === "CONVERTED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "REJECTED" || status === "LOST" || status === "CANCELLED"
        ? "bg-red-100 text-red-800"
        : status === "DRAFT"
          ? "bg-slate-100 text-slate-700"
          : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

function MiniList({
  title,
  rows,
  nameKey,
  subKey,
  statusKey,
  hrefPrefix,
  idKey = "_id",
}: {
  title: string;
  rows: Record<string, unknown>[];
  nameKey: string;
  subKey: string;
  statusKey: string;
  hrefPrefix: string;
  idKey?: string;
}) {
  return (
    <div className="gs-card p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No records yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={String(row[idKey])} className="flex items-center justify-between gap-2 text-sm">
              <div>
                {hrefPrefix.includes("enquiries") ? (
                  <span className="font-medium">{String(row[nameKey] ?? "—")}</span>
                ) : (
                  <Link href={`${hrefPrefix}/${String(row[idKey])}`} className="font-medium text-[#4c7eff] hover:underline">
                    {String(row[nameKey] ?? "—")}
                  </Link>
                )}
                <p className="text-xs text-slate-500">{String(row[subKey] ?? "")}</p>
              </div>
              <StatusBadge status={String(row[statusKey] ?? "")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdmissionsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/admissions/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading dashboard…</p>;

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/modules/admissions/enquiries?new=1" className="gs-btn px-4 py-2 text-sm">
          New Enquiry
        </Link>
        <Link href="/modules/admissions/applications/new" className="gs-btn px-4 py-2 text-sm">
          New Application
        </Link>
        <Link href="/modules/admissions/direct" className="gs-btn px-4 py-2 text-sm bg-white text-slate-700 border border-slate-200">
          Direct Admission
        </Link>
        <Link href="/modules/admissions/reports" className="gs-btn px-4 py-2 text-sm bg-white text-slate-700 border border-slate-200">
          Reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Enquiries" value={stats.totalEnquiries} />
        <StatCard label="New Today" value={stats.newEnquiriesToday} />
        <StatCard label="Follow-ups Pending" value={stats.followUpsPending} />
        <StatCard label="Applications" value={stats.applicationsReceived} />
        <StatCard label="Confirmed" value={stats.admissionsConfirmed} />
        <StatCard label="Pending Admissions" value={stats.admissionsPending} />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
        <StatCard label="Upcoming Follow-ups" value={stats.upcomingFollowUps} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MiniList
          title="Recent Enquiries"
          rows={data.recentEnquiries}
          nameKey="studentName"
          subKey="enquiryNumber"
          statusKey="status"
          hrefPrefix="/modules/admissions/enquiries"
          idKey="enquiryNumber"
        />
        <MiniList
          title="Recent Applications"
          rows={data.recentApplications}
          nameKey="applicationNumber"
          subKey="applicationDate"
          statusKey="status"
          hrefPrefix="/modules/admissions/applications"
        />
        <MiniList
          title="Pending Applications"
          rows={data.pendingApplications}
          nameKey="applicationNumber"
          subKey="applicationDate"
          statusKey="status"
          hrefPrefix="/modules/admissions/applications"
        />
        <MiniList
          title="Pending Payments"
          rows={data.pendingPayments}
          nameKey="applicationNumber"
          subKey="applicationDate"
          statusKey="status"
          hrefPrefix="/modules/admissions/applications"
        />
        <MiniList
          title="Document Verification Pending"
          rows={data.documentsPending}
          nameKey="applicationNumber"
          subKey="applicationDate"
          statusKey="status"
          hrefPrefix="/modules/admissions/applications"
        />
      </div>
    </div>
  );
}
