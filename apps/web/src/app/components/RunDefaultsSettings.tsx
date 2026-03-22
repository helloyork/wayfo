"use client";

import { useEffect, useState } from "react";
import { apiBase } from "../../lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AgentModifierBlocksEditor } from "./AgentModifierBlocksEditor";

type AppSettingsResponse = {
  enumerateVariantsDefault: boolean;
  primaryImageCandidateCount: number;
  timezone: string;
  updatedAt: string | null;
  agentModifiers?: { wayfairAnswers?: string[] };
};

const fallbackTimezones = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

function getTimezoneOptions() {
  const resolved =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const supportedValuesOf = (
    Intl as { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf;
  const supported =
    typeof supportedValuesOf === "function"
      ? supportedValuesOf("timeZone")
      : fallbackTimezones;
  const options = new Set<string>(supported);
  options.add(resolved);
  return Array.from(options);
}

function badgeVariant(
  tone: "success" | "warning" | "danger"
): "success" | "warning" | "destructive" {
  if (tone === "success") return "success";
  if (tone === "danger") return "destructive";
  return "warning";
}

export function RunDefaultsSettings() {
  const [enumerateVariantsDefault, setEnumerateVariantsDefault] =
    useState(false);
  const [primaryImageCandidateCount, setPrimaryImageCandidateCount] =
    useState(4);
  const [timezone, setTimezone] = useState("UTC");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<
    "success" | "warning" | "danger"
  >("warning");
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/app`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setStatusTone("danger");
      setStatus("读取默认配置失败");
      return;
    }
    const payload = (await res.json()) as AppSettingsResponse;
    setEnumerateVariantsDefault(payload.enumerateVariantsDefault);
    setPrimaryImageCandidateCount(payload.primaryImageCandidateCount ?? 4);
    setTimezone(payload.timezone || "UTC");
    setUpdatedAt(payload.updatedAt);
    setWayfairModifierBlocks(payload.agentModifiers?.wayfairAnswers ?? []);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enumerateVariantsDefault,
          primaryImageCandidateCount,
          timezone,
        }),
      });
      if (!res.ok) {
        throw new Error("保存失败");
      }
      setStatusTone("success");
      setStatus("已保存默认 Run 配置");
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const selectClassName =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Run 默认配置</CardTitle>
        <CardDescription>
          创建 Run 时的默认行为与采集策略。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="enumerate-variants"
            checked={enumerateVariantsDefault}
            onChange={(e) => setEnumerateVariantsDefault(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="enumerate-variants" className="cursor-pointer">
              启用变体枚举
            </Label>
            <span className="text-sm text-muted-foreground">
              开启后将自动遍历变体并入列采集；默认关闭，仅处理输入 ASIN。
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="candidate-count">主图重绘候选数</Label>
          <span className="text-sm text-muted-foreground">
            控制主图重绘候选数量（1-8）。
          </span>
          <Input
            id="candidate-count"
            type="number"
            min={1}
            max={8}
            value={primaryImageCandidateCount}
            onChange={(e) =>
              setPrimaryImageCandidateCount(Number(e.target.value) || 1)
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone">计划时区</Label>
          <span className="text-sm text-muted-foreground">
            用于判断计划日期是否为“当天”。
          </span>
          <select
            id="timezone"
            className={selectClassName}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {getTimezoneOptions().map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Label>全局 Agent 修改器（Wayfair 填答）</Label>
          <span className="text-sm text-muted-foreground">
            与创建 Run 页的「全局修改器」为同一配置，保存在本地设置文件中。保存本卡片会写入；Orchestrator
            在填答时注入（计划表硬覆盖优先）。
          </span>
          <AgentModifierBlocksEditor
            idPrefix="settings-modifier"
            blocks={wayfairModifierBlocks}
            onChange={setWayfairModifierBlocks}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave} disabled={loading}>
            保存
          </Button>
          {updatedAt ? (
            <span className="text-sm text-muted-foreground">
              更新于 {updatedAt}
            </span>
          ) : null}
        </div>
        {status ? (
          <Badge variant={badgeVariant(statusTone)}>{status}</Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}
