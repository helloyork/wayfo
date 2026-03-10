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

type R2SettingsResponse = {
  hasCredentials: boolean;
  maskedAccessKeyId: string | null;
  accountId: string | null;
  bucketName: string | null;
  publicUrlBase: string | null;
  lifecycleDays: number;
  updatedAt: string | null;
};

function badgeVariant(
  tone: "success" | "warning" | "danger"
): "success" | "warning" | "destructive" {
  if (tone === "success") return "success";
  if (tone === "danger") return "destructive";
  return "warning";
}

export function R2Settings() {
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [publicUrlBase, setPublicUrlBase] = useState("");
  const [lifecycleDays, setLifecycleDays] = useState(7);

  const [maskedAccessKeyId, setMaskedAccessKeyId] = useState<string | null>(
    null
  );
  const [hasCredentials, setHasCredentials] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<
    "success" | "warning" | "danger"
  >("warning");
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/r2`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as R2SettingsResponse;
    setHasCredentials(payload.hasCredentials);
    setMaskedAccessKeyId(payload.maskedAccessKeyId);
    setAccountId(payload.accountId ?? "");
    setBucketName(payload.bucketName ?? "");
    setPublicUrlBase(payload.publicUrlBase ?? "");
    setLifecycleDays(payload.lifecycleDays ?? 7);
    setUpdatedAt(payload.updatedAt);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onSave = async () => {
    const trimmedAccessKeyId = accessKeyId.trim();
    const trimmedSecretAccessKey = secretAccessKey.trim();
    if (!accountId.trim() || !bucketName.trim() || !publicUrlBase.trim()) {
      setStatusTone("warning");
      setStatus("请填写所有必填字段");
      return;
    }
    if (Boolean(trimmedAccessKeyId) !== Boolean(trimmedSecretAccessKey)) {
      setStatusTone("warning");
      setStatus("accessKeyId 与 secretAccessKey 需要同时填写");
      return;
    }
    if (
      !hasCredentials &&
      (!trimmedAccessKeyId || !trimmedSecretAccessKey)
    ) {
      setStatusTone("warning");
      setStatus("请补全 accessKeyId 与 secretAccessKey");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/r2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          accessKeyId: trimmedAccessKeyId || undefined,
          secretAccessKey: trimmedSecretAccessKey || undefined,
          bucketName,
          publicUrlBase,
          lifecycleDays,
        }),
      });
      if (!res.ok) {
        throw new Error("保存失败");
      }
      setStatusTone("success");
      setStatus("已保存 R2 配置");
      await loadSettings();
      setAccessKeyId("");
      setSecretAccessKey("");
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const onValidate = async () => {
    setLoading(true);
    try {
      const trimmedAccessKeyId = accessKeyId.trim();
      const trimmedSecretAccessKey = secretAccessKey.trim();
      const body = {
        accountId,
        bucketName,
        publicUrlBase,
        lifecycleDays,
        ...(trimmedAccessKeyId ? { accessKeyId: trimmedAccessKeyId } : {}),
        ...(trimmedSecretAccessKey
          ? { secretAccessKey: trimmedSecretAccessKey }
          : {}),
      };
      const res = await fetch(`${apiBase}/api/settings/r2/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "验证失败");
      }
      const payload = (await res.json()) as { bucket?: string };
      setStatusTone("success");
      setStatus(`R2 连接成功（Bucket: ${payload.bucket}）`);
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "验证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Cloudflare R2 存储</CardTitle>
        <CardDescription>
          配置 R2 对象存储，用于上传重绘后的图片并获取公开 URL。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="r2-account">Account ID</Label>
          <Input
            id="r2-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Cloudflare Account ID"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r2-access">Access Key ID</Label>
          <Input
            id="r2-access"
            type="password"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            placeholder={
              maskedAccessKeyId
                ? `已保存 ${maskedAccessKeyId}`
                : "R2 Access Key ID"
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r2-secret">Secret Access Key</Label>
          <Input
            id="r2-secret"
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            placeholder={
              hasCredentials ? "已保存 ********" : "R2 Secret Access Key"
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r2-bucket">Bucket Name</Label>
          <Input
            id="r2-bucket"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            placeholder="my-wayfo-bucket"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r2-url">Public URL Base</Label>
          <Input
            id="r2-url"
            value={publicUrlBase}
            onChange={(e) => setPublicUrlBase(e.target.value)}
            placeholder="https://pub-xxx.r2.dev 或自定义域名"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r2-lifecycle">对象生命周期（天）</Label>
          <Input
            id="r2-lifecycle"
            type="number"
            min={1}
            max={365}
            value={lifecycleDays}
            onChange={(e) =>
              setLifecycleDays(Number(e.target.value) || 7)
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave} disabled={loading}>
            保存
          </Button>
          <Button type="button" onClick={onValidate} disabled={loading}>
            验证连接
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
