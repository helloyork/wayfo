"use client";

import { useEffect, useState } from "react";
import { apiBase } from "../../lib/api";

type AppSettingsResponse = {
  enumerateVariantsDefault: boolean;
  updatedAt: string | null;
};

export function RunDefaultsSettings() {
  const [enumerateVariantsDefault, setEnumerateVariantsDefault] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "warning" | "danger">(
    "warning"
  );
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/app`, { cache: "no-store" });
    if (!res.ok) {
      setStatusTone("danger");
      setStatus("读取默认配置失败");
      return;
    }
    const payload = (await res.json()) as AppSettingsResponse;
    setEnumerateVariantsDefault(payload.enumerateVariantsDefault);
    setUpdatedAt(payload.updatedAt);
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
        body: JSON.stringify({ enumerateVariantsDefault })
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

  return (
    <div className="card stack">
      <strong>Run 默认配置</strong>
      <div className="muted">创建 Run 时的默认行为与采集策略。</div>
      <label className="row">
        <input
          type="checkbox"
          checked={enumerateVariantsDefault}
          onChange={(event) => setEnumerateVariantsDefault(event.target.checked)}
        />
        <div className="stack" style={{ gap: 6 }}>
          <span>启用变体枚举</span>
          <span className="muted">
            开启后将自动遍历变体并入列采集；默认关闭，仅处理输入 ASIN。
          </span>
        </div>
      </label>
      <div className="row">
        <button className="btn" type="button" onClick={onSave} disabled={loading}>
          保存
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
