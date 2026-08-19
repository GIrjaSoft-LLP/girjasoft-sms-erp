"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/client";

type Ticket = {
  _id: string;
  ticketNumber: string;
  schoolName: string;
  schoolCode: string;
  subject: string;
  type: string;
  priority: string;
  status: string;
  module?: string;
  page?: string;
  description: string;
  createdByName: string;
  createdByEmail?: string;
  createdByRole?: string;
  createdAt: string;
  assignedToId?: string;
  assignedToName?: string;
  resolution?: string;
  attachments?: Array<{ name: string; url: string }>;
  messages?: Array<{
    _id?: string;
    authorName: string;
    authorType: string;
    body: string;
    visibility?: string;
    createdAt?: string;
    attachments?: Array<{ name: string; url: string }>;
  }>;
  events?: Array<{ action: string; actorName: string; detail?: string; createdAt?: string }>;
};

export default function PlatformTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [admins, setAdmins] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [resolution, setResolution] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const [data, me] = await Promise.all([
      api<{ item: Ticket; admins: Array<{ id: string; name: string; email: string }> }>(`/api/platform/tickets/${params.id}`),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ]);
    setTicket(data.item);
    setAdmins(data.admins);
    setPermissions(me.user.permissions ?? []);
    setStatus(data.item.status);
    setPriority(data.item.priority);
    setAssignedToId(data.item.assignedToId ?? "");
    setResolution(data.item.resolution ?? "");
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function save() {
    setError("");
    try {
      const data = await api<{ item: Ticket }>(`/api/platform/tickets/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, priority, assignedToId, resolution }),
      });
      setTicket(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const body = new FormData();
    body.append("body", reply);
    body.append("visibility", internal ? "INTERNAL" : "PUBLIC");
    if (file) body.append("file", file);
    const response = await fetch(`/api/platform/tickets/${params.id}/messages`, { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError((data as { error?: string }).error || "Could not send message");
      return;
    }
    setTicket((data as { item: Ticket }).item);
    setReply("");
    setFile(null);
  }

  if (!ticket && !error) return <p>Loading ticket…</p>;

  const canEdit = permissions.includes("platform.tickets.edit");
  const canAssign = permissions.includes("platform.tickets.assign");

  return (
    <div className="space-y-6">
      <Link href="/platform/tickets" className="text-sm text-[#4c7eff]">
        ← Tickets
      </Link>
      {error ? <p className="text-red-600">{error}</p> : null}
      {ticket ? (
        <>
          <div className="gs-card p-5 space-y-2 text-sm">
            <h1 className="text-xl font-semibold">{ticket.ticketNumber}</h1>
            <p>{ticket.subject}</p>
            <p className="text-slate-500">
              {ticket.schoolName} ({ticket.schoolCode}) · {ticket.createdByName} · {ticket.createdByRole}
            </p>
            <p>{ticket.description}</p>
            {ticket.attachments?.map((item) => (
              <a key={item.url} href={item.url} className="block text-[#4c7eff]" target="_blank" rel="noreferrer">
                {item.name}
              </a>
            ))}
          </div>
          {canEdit || canAssign ? (
            <div className="gs-card grid gap-3 p-5 md:grid-cols-2">
              <label className="text-sm">
                Status
                <select className="gs-input mt-1" value={status} disabled={!canEdit} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOR_SCHOOL">Waiting for School</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <label className="text-sm">
              Priority
              <select className="gs-input mt-1" value={priority} disabled={!canEdit} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label className="text-sm">
              Assign to
              <select className="gs-input mt-1" value={assignedToId} disabled={!canAssign} onChange={(e) => setAssignedToId(e.target.value)}>
                <option value="">Unassigned</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name} ({admin.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              Resolution
              <textarea className="gs-input mt-1 min-h-20" value={resolution} disabled={!canEdit} onChange={(e) => setResolution(e.target.value)} />
            </label>
            {canEdit ? (
              <div>
                <button type="button" className="gs-btn px-4 py-2" onClick={() => void save()}>
                  Save changes
                </button>
              </div>
            ) : null}
          </div>
          ) : null}
          <div className="gs-card p-5 space-y-3">
            <h2 className="font-semibold">Conversation</h2>
            {(ticket.messages ?? []).map((message, index) => (
              <div
                key={message._id || index}
                className={`rounded-lg border p-3 text-sm ${
                  message.visibility === "INTERNAL" ? "border-amber-200 bg-amber-50" : "border-slate-100"
                }`}
              >
                <p className="text-xs text-slate-500">
                  {message.authorName} · {message.visibility === "INTERNAL" ? "Internal note" : message.authorType} ·{" "}
                  {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                </p>
                <p className="mt-1">{message.body}</p>
              </div>
            ))}
            {canEdit ? (
              <form onSubmit={(e) => void send(e)} className="space-y-2">
                <textarea className="gs-input min-h-24" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Public reply or internal note" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Internal note (not visible to the school)
                </label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button className="gs-btn px-4 py-2">Send</button>
              </form>
            ) : null}
          </div>
          <div className="gs-card p-5 text-sm">
            <h2 className="mb-2 font-semibold">History</h2>
            {(ticket.events ?? []).map((event, index) => (
              <p key={index} className="text-slate-600">
                {event.createdAt ? new Date(event.createdAt).toLocaleString() : ""} — {event.action}
                {event.actorName ? ` by ${event.actorName}` : ""}
                {event.detail ? ` (${event.detail})` : ""}
              </p>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
