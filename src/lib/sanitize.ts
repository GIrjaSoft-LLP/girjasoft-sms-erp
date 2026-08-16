const SECRET_KEYS = new Set([
  "password",
  "passwordHash",
  "confirmPassword",
  "currentPassword",
  "newPassword",
  "secret",
  "token",
  "resetToken",
  "resetTokenHash",
]);

export function stripClientWorkspaceId<T extends Record<string, unknown>>(
  body: T,
): Omit<T, "workspaceId" | "photo"> {
  const next = { ...body };
  delete next.workspaceId;
  delete next.photo;
  return next;
}

export function omitSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitSecrets(item)) as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => !SECRET_KEYS.has(key),
    );
    return Object.fromEntries(
      entries.map(([key, nested]) => [key, omitSecrets(nested)]),
    ) as T;
  }
  return value;
}

export function toClientUser(user: Record<string, unknown> | null | undefined) {
  if (!user) return null;
  return omitSecrets({
    ...user,
    passwordHash: undefined,
    resetTokenHash: undefined,
  });
}
