import { DEFAULT_ADMISSION_SETTINGS, type AdmissionSettings } from "@/config/admissions";
import { scopedQuery } from "@/lib/api/guards";
import { Settings } from "@/models/workspace";

export async function ensureAdmissionSettings(workspaceId: string) {
  const settings = await Settings.findOne(scopedQuery(workspaceId));
  if (!settings?.admission || !Object.keys(settings.admission as object).length) {
    await Settings.findOneAndUpdate(
      scopedQuery(workspaceId),
      { $set: { admission: DEFAULT_ADMISSION_SETTINGS } },
      { upsert: true },
    );
  }
}

export async function getAdmissionSettings(workspaceId: string): Promise<AdmissionSettings> {
  await ensureAdmissionSettings(workspaceId);
  const settings = await Settings.findOne(scopedQuery(workspaceId)).lean();
  const admission = (settings?.admission ?? {}) as Partial<AdmissionSettings>;
  return {
    ...DEFAULT_ADMISSION_SETTINGS,
    ...admission,
    feeHeads: { ...DEFAULT_ADMISSION_SETTINGS.feeHeads, ...(admission.feeHeads ?? {}) },
    documents: admission.documents?.length ? admission.documents : DEFAULT_ADMISSION_SETTINGS.documents,
    enquirySources: admission.enquirySources?.length
      ? admission.enquirySources
      : DEFAULT_ADMISSION_SETTINGS.enquirySources,
  };
}

export async function saveAdmissionSettings(workspaceId: string, patch: Partial<AdmissionSettings>) {
  const current = await getAdmissionSettings(workspaceId);
  const next = {
    ...current,
    ...patch,
    feeHeads: { ...current.feeHeads, ...(patch.feeHeads ?? {}) },
  };
  await Settings.findOneAndUpdate(
    scopedQuery(workspaceId),
    { $set: { admission: next } },
    { upsert: true, new: true },
  );
  return next;
}

export function buildDocumentChecklist(settings: AdmissionSettings) {
  return settings.documents.map((doc) => ({
    key: doc.key,
    name: doc.name,
    mandatory: doc.mandatory,
    url: "",
    mime: "",
    size: 0,
    status: "PENDING",
    verifiedBy: "",
    verifiedAt: null,
    remarks: "",
  }));
}
