"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ticketLabel } from "@/config/tickets";
import { api } from "@/lib/client";

type Message = {
  _id?: string;
  authorName: string;
  authorType: string;
  body: string;
  visibility?: string;
  createdAt?: string;
  attachments?: Array<{ name: string; url: string }>;
};

type Ticket = {
  _id: string;
  ticketNumber: string;
  subject: string;
  type: string;
  priority: string;
  status: string;
  module?: string;
  page?: string;
  description: string;
  createdByName: string;
  createdAt: string;
  resolution?: string;
  attachments?: Array<{ name: string; url: string }>;
  messages?: Message[];
  events?: Array<{ action: string; actorName: string; detail?: string; createdAt?: string }>;
};

export default function HelpTicketPage() {
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api<{ item: Ticket }>(`/api/help/tickets/${params.id}`);
    setTicket(data.item);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.append("body", reply);
      if (file) body.append("file", file);
      const response = await fetch(`/api/help/tickets/${params.id}/messages`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || "Could not send reply");
      setTicket((data as { item: Ticket }).item);
      setReply("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setSaving(false);
    }
  }

  async function act(action: "confirm" | "reopen") {
    setError("");
    try {
      const data = await api<{ item: Ticket }>(`/api/help/tickets/${params.id}/action`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setTicket(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (!ticket && !error) return <p>Loading ticket…</p>;

  return (
    <div className="space-y-6">
      <Link href="/help" className="text-sm text-[#4c7eff]">
        ← My Tickets
      </Link>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ticket ? (
        <>
          <div className="gs-card p-5 space-y-2 text-sm">
            <h1 className="text-xl font-semibold text-[#0b1b3a]">Ticket: {ticket.ticketNumber}</h1>
            <p><span className="text-slate-500">Subject:</span> {ticket.subject}</p>
            <p><span className="text-slate-500">Type:</span> {ticketLabel(ticket.type)}</p>
            <p><span className="text-slate-500">Priority:</span> {ticketLabel(ticket.priority)}</p>
            <p><span className="text-slate-500">Status:</span> {ticketLabel(ticket.status)}</p>
            <p><span className="text-slate-500">Module:</span> {ticket.module}{ticket.page ? ` · ${ticket.page}` : ""}</p>
            <p><span className="text-slate-500">Created by:</span> {ticket.createdByName}</p>
            <p><span className="text-slate-500">Created:</span> {new Date(ticket.createdAt).toLocaleString()}</p>
            <p className="pt-2">{ticket.description}</p>
            {ticket.resolution ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                <span className="font-medium">Resolution: </span>
                {ticket.resolution}
              </p>
            ) : null}
            {ticket.attachments?.length ? (
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((item) => (
                  <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="text-[#4c7eff]">
                    {item.name}
                  </a>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {ticket.status === "RESOLVED" ? (
                <button type="button" className="gs-btn px-3 py-2" onClick={() => void act("confirm")}>
                  Confirm Resolution
                </button>
              ) : null}
              {ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? (
                <button type="button" className="rounded-lg border px-3 py-2" onClick={() => void act("reopen")}>
                  Reopen Ticket
                </button>
              ) : null}
            </div>
          </div>
          <div className="gs-card p-5 space-y-3">
            <h2 className="font-semibold">Conversation</h2>
            {(ticket.messages ?? []).map((message, index) => (
              <div key={message._id || index} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="text-xs text-slate-500">
                  {message.authorName} · {message.authorType === "PLATFORM" ? "Support" : "School"} ·{" "}
                  {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                </p>
                <p className="mt-1">{message.body}</p>
                {message.attachments?.map((item) => (
                  <a key={item.url} href={item.url} className="mt-1 block text-[#4c7eff]" target="_blank" rel="noreferrer">
                    {item.name}
                  </a>
                ))}
              </div>
            ))}
            {ticket.status !== "CLOSED" ? (
              <form onSubmit={sendReply} className="space-y-2">
                <textarea className="gs-input min-h-24" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add a reply" />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button className="gs-btn px-4 py-2" disabled={saving}>
                  {saving ? "Sending…" : "Send reply"}
                </button>
              </form>
            ) : null}
          </div>
          <div className="gs-card p-5 text-sm">
            <h2 className="mb-2 font-semibold">History</h2>
            <ul className="space-y-1 text-slate-600">
              {(ticket.events ?? []).map((event, index) => (
                <li key={index}>
                  {event.createdAt ? new Date(event.createdAt).toLocaleString() : ""} — {event.action}
                  {event.actorName ? ` by ${event.actorName}` : ""}
                  {event.detail ? ` (${event.detail})` : ""}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
