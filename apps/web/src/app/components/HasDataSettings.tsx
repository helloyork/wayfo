"use client";

import { useEffect, useState } from "react";
import { apiBase } from "../../lib/api";

type HasDataSettingsResponse = {
  hasKey: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
};

export function HasDataSettings() {
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "warning" | "danger">(
    "warning"
  );
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/hasdata`, {
      cache: "no-store"
    });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as HasDataSettingsResponse;
    setMaskedKey(payload.maskedKey);
    setUpdatedAt(payload.updatedAt);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onSave = async () => {
    if (!apiKey.trim()) {
      setStatusTone("warning");
      setStatus("请输入 HasData API Key");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/hasdata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      if (!res.ok) {
        throw new Error("保存失败");
      }
      setStatusTone("success");
      setStatus("已保存 HasData API Key");
      await loadSettings();
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
      const res = await fetch(`${apiBase}/api/settings/hasdata/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: apiKey.trim() ? JSON.stringify({ apiKey }) : JSON.stringify({})
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "验证失败");
      }
      setStatusTone("success");
      setStatus("HasData API Key 验证通过");
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
      <strong>HasData API Key</strong>
      <div className="muted">
        采集 Amazon 商品数据所需的密钥，保存在本地安全存储。
      </div>
      <label className="stack">
        <span className="muted">API Key</span>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={maskedKey ? `已保存 ${maskedKey}` : "输入 HasData API Key"}
        />
      </label>
      <div className="row">
        <button className="btn" type="button" onClick={onSave} disabled={loading}>
          保存
        </button>
        <button className="btn" type="button" onClick={onValidate} disabled={loading}>
          验证
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
