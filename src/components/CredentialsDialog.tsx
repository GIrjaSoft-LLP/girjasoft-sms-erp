"use client";

export function CredentialsDialog({
  title,
  name,
  username,
  password,
  role,
  onClose,
}: {
  title: string;
  name?: string;
  username: string;
  password: string;
  role: string;
  onClose: () => void;
}) {
  const all = [name ? `Name: ${name}` : "", `Username: ${username}`, `Password: ${password}`, `Role: ${role}`]
    .filter(Boolean)
    .join("\n");

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-600">Save these credentials now. The password will not be shown again.</p>
        <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
          {name ? (
            <p>
              <span className="text-slate-500">Name:</span> {name}
            </p>
          ) : null}
          <p>
            <span className="text-slate-500">Username:</span> {username}
          </p>
          <p>
            <span className="text-slate-500">Password:</span> {password}
          </p>
          <p>
            <span className="text-slate-500">Role:</span> {role}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="gs-btn px-3 py-2 text-sm" onClick={() => copy(username)}>
            Copy username
          </button>
          <button type="button" className="gs-btn px-3 py-2 text-sm" onClick={() => copy(password)}>
            Copy password
          </button>
          <button type="button" className="px-3 py-2 text-sm text-slate-600" onClick={() => copy(all)}>
            Copy all
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" className="gs-btn px-4 py-2" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
