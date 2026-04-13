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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

type RunEvent = {
  id: string;
  type: string;
  message?: string;
  step?: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export function RunEventStream({
  runId,
  defaultOpen = false,
}: {
  runId: string;
  /** Collapsed by default to reduce noise on run detail (SSE still connects). */
  defaultOpen?: boolean;
}) {
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
    <Card
      id="run-events"
      className="scroll-mt-24 border-border/80 shadow-sm bg-muted/20"
    >
      <Collapsible defaultOpen={defaultOpen} className="group">
        <CollapsibleTrigger className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
          <CardHeader className="cursor-pointer pb-2 transition-colors hover:bg-muted/40">
            <div className="flex flex-wrap items-center gap-2">
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
              <CardTitle className="text-base">事件流</CardTitle>
              <Badge variant="outline" className="font-normal">
                状态: {status}
              </Badge>
              <span className="text-xs text-muted-foreground">调试与排错 · 点击展开</span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                暂无事件
              </div>
            ) : (
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto font-mono text-xs text-muted-foreground sm:text-sm">
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
