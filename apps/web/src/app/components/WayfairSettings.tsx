"use client";

import { useEffect, useRef, useState } from "react";
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

type WayfairEnv = "sandbox" | "prod";

type WayfairEnvSummary = {
  hasCredentials: boolean;
  maskedClientId: string | null;
  maskedClientSecret: string | null;
  audience: string | null;
  supplierId: string | null;
  updatedAt: string | null;
};

type WayfairSettingsResponse = {
  activeEnv: WayfairEnv | null;
  activeHasCredentials: boolean;
  sandbox: WayfairEnvSummary;
  prod: WayfairEnvSummary;
};

function defaultAudienceForEnv(env: WayfairEnv) {
  return env === "sandbox"
    ? "https://sandbox.api.wayfair.com/"
    : "https://api.wayfair.com/";
}

function badgeVariant(
  tone: "success" | "warning" | "danger"
): "success" | "warning" | "destructive" {
  if (tone === "success") return "success";
  if (tone === "danger") return "destructive";
  return "warning";
}

export function WayfairSettings() {
  const [env, setEnv] = useState<WayfairEnv>("sandbox");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [audience, setAudience] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const [maskedClientId, setMaskedClientId] = useState<string | null>(null);
  const [maskedClientSecret, setMaskedClientSecret] = useState<string | null>(
    null
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sandboxSummary, setSandboxSummary] =
    useState<WayfairEnvSummary | null>(null);
  const [prodSummary, setProdSummary] = useState<WayfairEnvSummary | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<
    "success" | "warning" | "danger"
  >("warning");
  const [loading, setLoading] = useState(false);

  const prevEnvRef = useRef<WayfairEnv>(env);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/wayfair`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as WayfairSettingsResponse;
    setEnv(payload.activeEnv ?? "sandbox");
    setSandboxSummary(payload.sandbox);
    setProdSummary(payload.prod);

    const current =
      (payload.activeEnv ?? env) === "sandbox"
        ? payload.sandbox
        : payload.prod;
    setMaskedClientId(current.maskedClientId);
    setMaskedClientSecret(current.maskedClientSecret);
    setUpdatedAt(current.updatedAt);
    setAudience(current.audience ?? "");
    setSupplierId(current.supplierId ?? "");
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const summary = env === "sandbox" ? sandboxSummary : prodSummary;
    if (!summary) {
      return;
    }
    setMaskedClientId(summary.maskedClientId);
    setMaskedClientSecret(summary.maskedClientSecret);
    setUpdatedAt(summary.updatedAt);
    setAudience(summary.audience ?? "");
    setSupplierId(summary.supplierId ?? "");
    setClientId("");
    setClientSecret("");
  }, [env, sandboxSummary, prodSummary]);

  useEffect(() => {
    const prevEnv = prevEnvRef.current;
    const prevDefault = defaultAudienceForEnv(prevEnv);
    const nextDefault = defaultAudienceForEnv(env);
    setAudience((current) => {
      const trimmed = current.trim();
      if (!trimmed) {
        return nextDefault;
      }
      if (trimmed === prevDefault) {
        return nextDefault;
      }
      return current;
    });
    prevEnvRef.current = env;
  }, [env]);

  const onSave = async () => {
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    const currentSummary = env === "sandbox" ? sandboxSummary : prodSummary;
    if (!audience.trim() || !supplierId.trim()) {
      setStatusTone("warning");
      setStatus("请填写 audience 与 supplierId");
      return;
    }
    if (Boolean(trimmedClientId) !== Boolean(trimmedClientSecret)) {
      setStatusTone("warning");
      setStatus("clientId 与 clientSecret 需要同时填写");
      return;
    }
    if (
      !currentSummary?.hasCredentials &&
      (!trimmedClientId || !trimmedClientSecret)
    ) {
      setStatusTone("warning");
      setStatus("请补全 clientId 与 clientSecret");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/wayfair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env,
          clientId: trimmedClientId || undefined,
          clientSecret: trimmedClientSecret || undefined,
          audience,
          supplierId,
        }),
      });
      if (!res.ok) {
        throw new Error("保存失败");
      }
      setStatusTone("success");
      setStatus("已保存 Wayfair 凭据");
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const onEnvChange = async (newEnv: WayfairEnv) => {
    setEnv(newEnv);
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/settings/wayfair`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeEnv: newEnv }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "切换失败");
      }
      await loadSettings();
      setStatusTone("success");
      setStatus(
        `已切换到 ${newEnv === "sandbox" ? "Sandbox（沙盒）" : "Production（生产）"}`
      );
    } catch (error) {
      await loadSettings();
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "切换失败");
    } finally {
      setLoading(false);
    }
  };

  const onValidate = async () => {
    setLoading(true);
    try {
      const trimmedClientId = clientId.trim();
      const trimmedClientSecret = clientSecret.trim();
      const body = {
        env,
        audience,
        supplierId,
        ...(trimmedClientId ? { clientId: trimmedClientId } : {}),
        ...(trimmedClientSecret ? { clientSecret: trimmedClientSecret } : {}),
      };
      const res = await fetch(`${apiBase}/api/settings/wayfair/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "验证失败");
      }
      const payload = (await res.json()) as { expiresAt?: string };
      setStatusTone("success");
      setStatus(
        payload.expiresAt
          ? `Wayfair token 获取成功（有效期至 ${payload.expiresAt}）`
          : "Wayfair token 获取成功"
      );
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "验证失败");
    } finally {
      setLoading(false);
    }
  };

  const selectClassName =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Wayfair 凭据</CardTitle>
        <CardDescription>
          填写并切换 API 目的地（沙盒/生产），用于获取 token 与后续 GraphQL 调用。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="wayfair-env">当前环境</Label>
          <select
            id="wayfair-env"
            className={selectClassName}
            value={env}
            onChange={(event) => onEnvChange(event.target.value as WayfairEnv)}
            disabled={loading}
          >
            <option value="sandbox">Sandbox（沙盒）</option>
            <option value="prod">Production（生产）</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Sandbox：{sandboxSummary?.hasCredentials ? "已配置" : "未配置"}</span>
          <span>Production：{prodSummary?.hasCredentials ? "已配置" : "未配置"}</span>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="wayfair-client">App ID（clientId）</Label>
          <Input
            id="wayfair-client"
            type="password"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={
              maskedClientId ? `已保存 ${maskedClientId}` : "输入 clientId"
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wayfair-secret">密钥（clientSecret）</Label>
          <Input
            id="wayfair-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={
              maskedClientSecret
                ? `已保存 ${maskedClientSecret}`
                : "输入 clientSecret"
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wayfair-audience">Audience</Label>
          <Input
            id="wayfair-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder={defaultAudienceForEnv(env)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wayfair-supplier">Supplier ID</Label>
          <Input
            id="wayfair-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="输入唯一 supplierId"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave} disabled={loading}>
            保存
          </Button>
          <Button type="button" onClick={onValidate} disabled={loading}>
            验证并获取 token
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
