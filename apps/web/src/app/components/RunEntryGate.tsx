"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiBase } from "../../lib/api";
import { CreateRunForm } from "./CreateRunForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_MARKET_CONTEXT,
  MARKET_CONTEXT_PRESETS,
} from "@/lib/marketContext";

type InitStatus = {
  ready: boolean;
  prerequisites: { wayfair: boolean };
  activeEnv: "sandbox" | "prod" | null;
  marketContextValid: boolean;
  taxonomy: {
    state: "READY" | "STALE" | "REFRESHING" | "BUILDING" | "MISSING";
    expiresAt: string | null;
    lastRefreshError: string | null;
  };
  task: null | {
    key: string;
    status: "IDLE" | "RUNNING" | "SUCCEEDED" | "FAILED";
    phase?: string;
    message?: string;
    page?: number;
    totalPages?: number;
    startedAt?: string;
    updatedAt?: string;
    error?: string;
  };
};

const storageKey = "wayfo.marketContext";

function percent(page?: number, total?: number) {
  if (!page || !total || total <= 0) {
    return null;
  }
  const value = Math.min(100, Math.max(0, Math.round((page / total) * 100)));
  return value;
}

export function RunEntryGate() {
  const [marketContext, setMarketContext] = useState(DEFAULT_MARKET_CONTEXT);
  const [status, setStatus] = useState<InitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const marketContextForQuery = useMemo(() => marketContext.trim(), [marketContext]);

  const load = async () => {
    const qs = new URLSearchParams();
    if (marketContextForQuery) {
      qs.set("marketContext", marketContextForQuery);
    }
    const res = await fetch(`${apiBase}/api/init/status?${qs.toString()}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as InitStatus;
    setStatus(payload);
  };

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const raw = stored?.trim() ?? "";
    if (!raw) {
      setMarketContext(DEFAULT_MARKET_CONTEXT);
      return;
    }
    const match = MARKET_CONTEXT_PRESETS.find((p) => {
      try {
        const a = JSON.parse(p.value) as { locale: string; country: string; brand: string };
        const b = JSON.parse(raw) as { locale?: string; country?: string; brand?: string };
        return a.locale === b.locale && a.country === b.country && a.brand === b.brand;
      } catch {
        return p.value === raw;
      }
    });
    setMarketContext(match?.value ?? DEFAULT_MARKET_CONTEXT);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketContextForQuery]);

  useEffect(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const interval =
      status?.task?.status === "RUNNING" || status?.taxonomy?.state === "BUILDING" ? 1000 : 5000;
    pollRef.current = window.setInterval(() => {
      load();
    }, interval);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.task?.status, status?.taxonomy?.state, marketContextForQuery]);

  const onStartInit = async () => {
    if (!marketContext.trim()) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/init/taxonomy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketContext })
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "初始化启动失败");
      }
      await load();
    } finally {
      setLoading(false);
    }
  };

  const onMarketContextChange = (next: string) => {
    setMarketContext(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next);
    }
  };

  if (!status || !status.ready) {
    const pct = percent(status?.task?.page, status?.task?.totalPages);
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>初始化</CardTitle>
          <CardDescription>首次使用需要先初始化 taxonomy</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            前置条件：
            <span>
              Wayfair 凭据 {status?.prerequisites.wayfair ? "✅" : "❌"}
            </span>
            {status?.activeEnv ? (
              <span> · 当前环境 {status.activeEnv}</span>
            ) : null}
            {" · "}
            <Link href="/settings" className="text-primary hover:underline">
              去设置页
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Market Context</Label>
            <Select
              value={marketContext}
              onValueChange={(value) => onMarketContextChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择市场" />
              </SelectTrigger>
              <SelectContent>
                {MARKET_CONTEXT_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!status?.marketContextValid ? (
              <span className="text-sm text-muted-foreground">
                请从下拉框选择有效的 Market Context
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={onStartInit}
              disabled={
                loading ||
                !status?.prerequisites.wayfair ||
                !status?.marketContextValid ||
                status?.task?.status === "RUNNING"
              }
            >
              {status?.task?.status === "RUNNING" ? "初始化进行中..." : "开始初始化"}
            </Button>
            <span className="text-sm text-muted-foreground">
              状态：{status?.taxonomy.state ?? "MISSING"}
              {status?.taxonomy.expiresAt
                ? `（过期时间 ${status.taxonomy.expiresAt}）`
                : ""}
            </span>
          </div>

          {status?.task ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {status.task.phase ?? "INIT"}：{status.task.message ?? ""}
                </span>
                {pct !== null ? <span>{pct}%</span> : null}
              </div>
              {status.task.status === "FAILED" ? (
                <Badge variant="destructive">
                  {status.task.error ?? "初始化失败"}
                </Badge>
              ) : status.task.status === "SUCCEEDED" ? (
                <Badge variant="success">初始化完成</Badge>
              ) : (
                <Badge variant="warning">初始化中</Badge>
              )}
            </div>
          ) : null}

          {status?.taxonomy.lastRefreshError ? (
            <Badge variant="warning">{status.taxonomy.lastRefreshError}</Badge>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <CreateRunForm
      initialMarketContext={marketContext}
      onMarketContextChange={onMarketContextChange}
    />
  );
}
