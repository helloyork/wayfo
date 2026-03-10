"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase } from "../../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>事件流</CardTitle>
          <Badge variant="secondary">状态: {status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            暂无事件
          </div>
        ) : (
          <div className="flex flex-col gap-1 font-mono text-sm text-muted-foreground">
            {events.map((event) => (
              <div key={event.id}>
                {event.timestamp} · {event.type}{" "}
                {event.step ? `(${event.step})` : ""} {event.message ?? ""}
                {event.data?.err
                  ? ` · ${JSON.stringify(event.data.err)}`
                  : ""}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
