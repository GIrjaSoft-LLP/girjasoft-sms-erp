"use client";

import { use } from "react";
import { AdmissionApplicationForm } from "@/components/admissions/AdmissionApplicationForm";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdmissionApplicationForm applicationId={id} />;
}
