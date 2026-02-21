"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../lib/api";

type RunEvent = {
  id: string;
  type: string;
  message?: string;
  step?: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export function RunEventStream({ runId }: { runId: string }) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [status, setStatus] = useState<string>("PENDING");

  const sourceUrl = useMemo(
    () => `${apiBase}/api/runs/${runId}/events`,
    [runId]
  );

  useEffect(() => {
    const source = new EventSource(sourceUrl);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RunEvent;
        setEvents((prev) => [...prev.slice(-49), parsed]);
        if (parsed.data?.status) {
          setStatus(String(parsed.data.status));
        }
      } catch {
        // Ignore malformed events
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [sourceUrl]);

  return (
    <div className="card stack">
      <div className="row">
        <strong>事件流</strong>
        <span className="badge">状态: {status}</span>
      </div>
      {events.length === 0 ? (
        <div className="empty">暂无事件</div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="muted">
            {event.timestamp} · {event.type} {event.step ? `(${event.step})` : ""} {event.message ?? ""}
            {event.data?.err ? ` · ${JSON.stringify(event.data.err)}` : ""}
          </div>
        ))
      )}
    </div>
  );
}
