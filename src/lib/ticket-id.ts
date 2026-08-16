import { PlatformSettings } from "@/models/platform";

export async function nextTicketNumber() {
  const row = await PlatformSettings.findOneAndUpdate(
    { key: "supportTicketSeq" },
    { $inc: { "value.n": 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const n = Math.max(1, Number((row?.value as { n?: number } | undefined)?.n ?? 1));
  if (!Number.isFinite(n) || n < 1) {
    await PlatformSettings.updateOne({ key: "supportTicketSeq" }, { $set: { "value.n": 1 } });
    return "GS-TKT-000001";
  }
  return `GS-TKT-${String(n).padStart(6, "0")}`;
}
