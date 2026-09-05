"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Band = { min: number; max: number; rating: string };

export function GradeCriteriaEditor() {
  const [items, setItems] = useState<Band[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ items: Band[] }>("/api/marks/grade-criteria")
      .then((data) => setItems(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load rating criteria."));
  }, []);

  function update(index: number, patch: Partial<Band>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ message: string; items: Band[] }>("/api/marks/grade-criteria", {
        method: "PATCH",
        body: JSON.stringify({ items }),
      });
      setItems(data.items);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating criteria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gs-card space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold gs-heading">Rating Criteria</h3>
        <p className="text-xs gs-muted">Percentage ranges determine the student rating automatically.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 font-medium">Minimum %</th>
              <th className="p-3 font-medium">Maximum %</th>
              <th className="p-3 font-medium">Rating</th>
              <th className="p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => (
              <tr key={`${row.rating}-${index}`} className="border-t border-slate-100">
                <td className="p-3">
                  <input
                    type="number"
                    className="gs-input"
                    min={0}
                    max={100}
                    step="0.01"
                    value={row.min}
                    onChange={(e) => update(index, { min: Number(e.target.value) })}
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    className="gs-input"
                    min={0}
                    max={100}
                    step="0.01"
                    value={row.max}
                    onChange={(e) => update(index, { max: Number(e.target.value) })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="gs-input"
                    value={row.rating}
                    onChange={(e) => update(index, { rating: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border px-3 py-1.5 text-sm gs-tab"
          onClick={() => setItems((rows) => [...rows, { min: 0, max: 0, rating: "" }])}
        >
          Add Band
        </button>
        <button type="button" className="gs-btn px-4 py-2 text-sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save Criteria"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
