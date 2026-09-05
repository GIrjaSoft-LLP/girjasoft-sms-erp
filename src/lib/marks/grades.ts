export type GradeBand = {
  min: number;
  max: number;
  rating: string;
};

export const DEFAULT_GRADE_CRITERIA: GradeBand[] = [
  { min: 90, max: 100, rating: "A+" },
  { min: 85, max: 89.99, rating: "A" },
  { min: 80, max: 84.99, rating: "B+" },
  { min: 70, max: 79.99, rating: "B" },
  { min: 60, max: 69.99, rating: "C+" },
  { min: 50, max: 59.99, rating: "C" },
  { min: 40, max: 49.99, rating: "D" },
  { min: 0, max: 39.99, rating: "F" },
];

export function normalizeGradeCriteria(input: unknown): GradeBand[] {
  if (!Array.isArray(input)) return DEFAULT_GRADE_CRITERIA;
  const rows = input
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        min: Number(item.min),
        max: Number(item.max),
        rating: String(item.rating ?? "").trim(),
      };
    })
    .filter((row) => row.rating && Number.isFinite(row.min) && Number.isFinite(row.max));
  return rows.length ? rows : DEFAULT_GRADE_CRITERIA;
}

export function validateGradeCriteria(rows: GradeBand[]) {
  if (!rows.length) throw new Error("Add at least one rating band.");
  const sorted = [...rows].sort((a, b) => a.min - b.min);
  for (const row of sorted) {
    if (row.min < 0 || row.max > 100) throw new Error("Percentage ranges must stay between 0 and 100.");
    if (row.min > row.max) throw new Error("Minimum percentage cannot be greater than maximum.");
    if (!row.rating.trim()) throw new Error("Each band needs a rating name.");
  }
  if (sorted[0].min > 0) throw new Error("Criteria must start at 0%.");
  if (sorted[sorted.length - 1].max < 100) throw new Error("Criteria must include 100%.");
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].min < sorted[i - 1].max) {
      throw new Error("Percentage ranges must not overlap.");
    }
    if (sorted[i].min - sorted[i - 1].max > 0.02) {
      throw new Error("Criteria must not leave gaps between percentage ranges.");
    }
  }
  return sorted;
}

export function ratingForPercentage(percentage: number, criteria: GradeBand[]) {
  const bands = normalizeGradeCriteria(criteria);
  const match = bands.find((row) => percentage >= row.min && percentage <= row.max);
  return match?.rating ?? "";
}

export function roundMarks(value: number) {
  return Math.round(value * 100) / 100;
}
