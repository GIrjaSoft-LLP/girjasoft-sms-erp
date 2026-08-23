export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as { error?: string; message?: string; ok?: boolean };
    throw new Error(payload.error || payload.message || "Request failed");
  }
  return data as T;
}
