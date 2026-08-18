"use client";

import { useMemo, useState } from "react";

type Message = {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  sender: { name: string; role: "ADMIN" | "INTERNAL" | "CLIENT" };
  attachments: { id: string; fileName: string }[];
};

function formatDateTime(date: Date) {
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5 text-gray-900">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function CommunicationThread({
  messages,
  currentUserId,
  viewerIsClient,
  orgName,
}: {
  messages: Message[];
  currentUserId: string;
  viewerIsClient: boolean;
  orgName: string;
}) {
  const [query, setQuery] = useState("");

  // Clients see our organization's name instead of the individual staff
  // member who sent it - so the POC can change without the client noticing
  // a different "sender" mid-conversation. Staff always see the real name.
  const displayName = (m: Message) => (viewerIsClient && m.sender.role !== "CLIENT" ? orgName : m.sender.name);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.body.toLowerCase().includes(q) || displayName(m).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, query, viewerIsClient, orgName]);

  return (
    <>
      <div className="border-b border-gray-200 p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
        {query.trim() && (
          <p className="mt-1.5 text-xs text-gray-400">
            {filtered.length} of {messages.length} message{messages.length === 1 ? "" : "s"} match
          </p>
        )}
      </div>

      <div className="max-h-[28rem] space-y-4 overflow-y-auto p-5">
        {filtered.map((m) => (
          <div key={m.id} className={`flex ${m.senderId === currentUserId ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-lg rounded-lg px-4 py-2 text-sm ${
                m.senderId === currentUserId ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="text-xs opacity-70">
                {highlight(displayName(m), query)} · {formatDateTime(m.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{highlight(m.body, query)}</p>
              {m.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/attachments/${a.id}/download`}
                  className={`mt-2 block text-xs underline ${m.senderId === currentUserId ? "text-white" : "text-blue-600"}`}
                >
                  📎 {highlight(a.fileName, query)}
                </a>
              ))}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">No messages yet. Start the conversation below.</p>
        )}
        {messages.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-gray-400">No messages match &quot;{query}&quot;.</p>
        )}
      </div>
    </>
  );
}
