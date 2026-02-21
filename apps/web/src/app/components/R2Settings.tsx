"use client";

import { useEffect, useState } from "react";
import { apiBase } from "../../lib/api";

type R2SettingsResponse = {
  hasCredentials: boolean;
  maskedAccessKeyId: string | null;
  accountId: string | null;
  bucketName: string | null;
  publicUrlBase: string | null;
  lifecycleDays: number;
  updatedAt: string | null;
};

export function R2Settings() {
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [publicUrlBase, setPublicUrlBase] = useState("");
  const [lifecycleDays, setLifecycleDays] = useState(7);

  const [maskedAccessKeyId, setMaskedAccessKeyId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "warning" | "danger">("warning");
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/r2`, { cache: "no-store" });
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
    if (
      !accountId.trim() ||
      !accessKeyId.trim() ||
      !secretAccessKey.trim() ||
      !bucketName.trim() ||
      !publicUrlBase.trim()
    ) {
      setStatusTone("warning");
      setStatus("请填写所有必填字段");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/r2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          accessKeyId,
          secretAccessKey,
          bucketName,
          publicUrlBase,
          lifecycleDays
        })
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
      const hasOverride = Boolean(accessKeyId.trim()) || Boolean(secretAccessKey.trim());
      const body = hasOverride
        ? { accountId, accessKeyId, secretAccessKey, bucketName, publicUrlBase, lifecycleDays }
        : {};
      const res = await fetch(`${apiBase}/api/settings/r2/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
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
    <div className="card stack">
      <strong>Cloudflare R2 存储</strong>
      <div className="muted">配置 R2 对象存储，用于上传重绘后的图片并获取公开 URL。</div>

      <label className="stack">
        <span className="muted">Account ID</span>
        <input
          className="input"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          placeholder="Cloudflare Account ID"
        />
      </label>

      <label className="stack">
        <span className="muted">Access Key ID</span>
        <input
          className="input"
          type="password"
          value={accessKeyId}
          onChange={(event) => setAccessKeyId(event.target.value)}
          placeholder={maskedAccessKeyId ? `已保存 ${maskedAccessKeyId}` : "R2 Access Key ID"}
        />
      </label>

      <label className="stack">
        <span className="muted">Secret Access Key</span>
        <input
          className="input"
          type="password"
          value={secretAccessKey}
          onChange={(event) => setSecretAccessKey(event.target.value)}
          placeholder={hasCredentials ? "已保存 ********" : "R2 Secret Access Key"}
        />
      </label>

      <label className="stack">
        <span className="muted">Bucket Name</span>
        <input
          className="input"
          value={bucketName}
          onChange={(event) => setBucketName(event.target.value)}
          placeholder="my-wayfo-bucket"
        />
      </label>

      <label className="stack">
        <span className="muted">Public URL Base</span>
        <input
          className="input"
          value={publicUrlBase}
          onChange={(event) => setPublicUrlBase(event.target.value)}
          placeholder="https://pub-xxx.r2.dev 或自定义域名"
        />
      </label>

      <label className="stack">
        <span className="muted">对象生命周期（天）</span>
        <input
          className="input"
          type="number"
          min={1}
          max={365}
          value={lifecycleDays}
          onChange={(event) => setLifecycleDays(Number(event.target.value) || 7)}
        />
      </label>

      <div className="row">
        <button className="btn" type="button" onClick={onSave} disabled={loading}>
          保存
        </button>
        <button className="btn" type="button" onClick={onValidate} disabled={loading}>
          验证连接
        </button>
        {updatedAt ? <span className="muted">更新于 {updatedAt}</span> : null}
      </div>

      {status ? (
        <span
          className={`badge ${
            statusTone === "success"
              ? "badge-success"
              : statusTone === "danger"
              ? "badge-danger"
              : "badge-warning"
          }`}
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}
