"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase } from "../../lib/api";

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
  // Per Wayfair developer docs:
  // - Sandbox: https://sandbox.api.wayfair.com/
  // - Prod: https://api.wayfair.com/
  return env === "sandbox" ? "https://sandbox.api.wayfair.com/" : "https://api.wayfair.com/";
}

export function WayfairSettings() {
  const [env, setEnv] = useState<WayfairEnv>("sandbox");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [audience, setAudience] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const [maskedClientId, setMaskedClientId] = useState<string | null>(null);
  const [maskedClientSecret, setMaskedClientSecret] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sandboxSummary, setSandboxSummary] = useState<WayfairEnvSummary | null>(null);
  const [prodSummary, setProdSummary] = useState<WayfairEnvSummary | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "warning" | "danger">(
    "warning"
  );
  const [loading, setLoading] = useState(false);

  const prevEnvRef = useRef<WayfairEnv>(env);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/wayfair`, { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as WayfairSettingsResponse;
    if (payload.activeEnv) {
      setEnv(payload.activeEnv);
    }
    setSandboxSummary(payload.sandbox);
    setProdSummary(payload.prod);

    const current = (payload.activeEnv ?? env) === "sandbox" ? payload.sandbox : payload.prod;
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
    setStatus(null);
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
    if (!clientId.trim() || !clientSecret.trim() || !audience.trim() || !supplierId.trim()) {
      setStatusTone("warning");
      setStatus("请填写 env、app id、密钥、audience 与 supplierId");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/wayfair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env,
          clientId,
          clientSecret,
          audience,
          supplierId
        })
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

  const onValidate = async () => {
    setLoading(true);
    try {
      const hasCredentialsOverride = Boolean(clientId.trim()) || Boolean(clientSecret.trim());
      const body = hasCredentialsOverride
        ? { env, clientId, clientSecret, audience, supplierId }
        : {};
      const res = await fetch(`${apiBase}/api/settings/wayfair/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "验证失败");
      }
      const payload = (await res.json()) as { expiresAt?: string };
      setStatusTone("success");
      setStatus(payload.expiresAt ? `Wayfair token 获取成功（有效期至 ${payload.expiresAt}）` : "Wayfair token 获取成功");
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
      <strong>Wayfair 凭据</strong>
      <div className="muted">填写并切换 API 目的地（沙盒/生产），用于获取 token 与后续 GraphQL 调用。</div>

      <label className="stack">
        <span className="muted">环境</span>
        <select
          className="input"
          value={env}
          onChange={(event) => setEnv(event.target.value as WayfairEnv)}
        >
          <option value="sandbox">Sandbox（沙盒）</option>
          <option value="prod">Production（生产）</option>
        </select>
      </label>

      <div className="row muted" style={{ gap: 10 }}>
        <span>Sandbox：{sandboxSummary?.hasCredentials ? "已配置" : "未配置"}</span>
        <span>Production：{prodSummary?.hasCredentials ? "已配置" : "未配置"}</span>
      </div>

      <label className="stack">
        <span className="muted">App ID（clientId）</span>
        <input
          className="input"
          type="password"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          placeholder={maskedClientId ? `已保存 ${maskedClientId}` : "输入 clientId"}
        />
      </label>

      <label className="stack">
        <span className="muted">密钥（clientSecret）</span>
        <input
          className="input"
          type="password"
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
          placeholder={maskedClientSecret ? `已保存 ${maskedClientSecret}` : "输入 clientSecret"}
        />
      </label>

      <label className="stack">
        <span className="muted">Audience</span>
        <input
          className="input"
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
          placeholder={defaultAudienceForEnv(env)}
        />
      </label>

      <label className="stack">
        <span className="muted">Supplier ID</span>
        <input
          className="input"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          placeholder="输入唯一 supplierId"
        />
      </label>

      <div className="row">
        <button className="btn" type="button" onClick={onSave} disabled={loading}>
          保存
        </button>
        <button className="btn" type="button" onClick={onValidate} disabled={loading}>
          验证并获取 token
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

