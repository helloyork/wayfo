"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiBase } from "../../lib/api";

type BrandAssociation = {
  id: string;
  manufacturer: { id: string; name?: string | null };
};

type BrandsResponse = {
  brands: BrandAssociation[];
  cached: boolean;
  fetchedAt: string;
};

type PlanImportResponse = {
  timezone: string;
  today: string;
  summary: {
    rows: number;
    validRows: number;
    activatedRows: number;
  };
  errors: Array<{ row: number; message: string }>;
};

type PlanRunResponse = {
  timezone: string;
  today: string;
  summary: {
    planRows: number;
    createdRuns: number;
    skippedExisting: number;
    skippedSecondary: number;
  };
};

export function CreateRunForm({
  initialMarketContext,
  onMarketContextChange
}: {
  initialMarketContext?: string;
  onMarketContextChange?: (value: string) => void;
}) {
  const router = useRouter();
  const [amazonUrl, setAmazonUrl] = useState("");
  const [marketContext, setMarketContext] = useState(initialMarketContext ?? "");
  const [manufacturerId, setManufacturerId] = useState("");
  const [brands, setBrands] = useState<BrandAssociation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [planStatusTone, setPlanStatusTone] = useState<"success" | "warning" | "danger">(
    "warning"
  );
  const [planLoading, setPlanLoading] = useState(false);
  const [planRunStatus, setPlanRunStatus] = useState<string | null>(null);
  const [planRunStatusTone, setPlanRunStatusTone] = useState<"success" | "warning" | "danger">(
    "warning"
  );
  const [planRunLoading, setPlanRunLoading] = useState(false);

  const fetchBrands = useCallback(async (mc: string) => {
    setBrandsLoading(true);
    setBrandsError(null);
    try {
      const params = new URLSearchParams();
      if (mc) {
        params.set("marketContext", mc);
      }
      const url = `${apiBase}/api/wayfair/brands${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to fetch brands");
      }
      const data = (await res.json()) as BrandsResponse;
      setBrands(data.brands);
      if (data.brands.length > 0 && !manufacturerId) {
        setManufacturerId(data.brands[0].manufacturer?.id ?? "");
      }
    } catch (err) {
      setBrandsError(err instanceof Error ? err.message : "Failed to fetch brands");
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, [manufacturerId]);

  useEffect(() => {
    fetchBrands(marketContext);
  }, []);

  const handleMarketContextChange = (value: string) => {
    setMarketContext(value);
    onMarketContextChange?.(value);
    fetchBrands(value);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amazonUrl,
          marketContext: marketContext || undefined,
          manufacturerId: manufacturerId || undefined
        })
      });
      if (!res.ok) {
        throw new Error("Create run failed");
      }
      const run = (await res.json()) as { id: string };
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const onDownloadTemplate = () => {
    window.location.href = `${apiBase}/api/runs/plan-template`;
  };

  const onImportPlan = async () => {
    if (!planFile) {
      setPlanStatusTone("warning");
      setPlanStatus("请先选择 Excel 文件");
      return;
    }
    setPlanLoading(true);
    setPlanStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", planFile);
      if (marketContext.trim()) {
        formData.append("marketContext", marketContext.trim());
      }
      if (manufacturerId) {
        formData.append("manufacturerId", manufacturerId);
      }
      const res = await fetch(`${apiBase}/api/runs/plan-import`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "计划导入失败");
      }
      const payload = (await res.json()) as PlanImportResponse;
      const errorCount = payload.errors.length;
      setPlanStatusTone(errorCount > 0 ? "warning" : "success");
      setPlanStatus(
        `导入完成：${payload.summary.activatedRows} 行生效` +
          (errorCount > 0 ? `（${errorCount} 行有错误）` : "")
      );
      setPlanFile(null);
    } catch (err) {
      setPlanStatusTone("danger");
      setPlanStatus(err instanceof Error ? err.message : "计划导入失败");
    } finally {
      setPlanLoading(false);
    }
  };

  const onRunPlan = async () => {
    if (!marketContext.trim()) {
      setPlanRunStatusTone("warning");
      setPlanRunStatus("请先填写 Market Context");
      return;
    }
    setPlanRunLoading(true);
    setPlanRunStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/runs/plan-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketContext: marketContext.trim(),
          manufacturerId: manufacturerId || undefined
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "计划执行失败");
      }
      const payload = (await res.json()) as PlanRunResponse;
      setPlanRunStatusTone("success");
      setPlanRunStatus(
        `执行完成：${payload.summary.createdRuns} 个任务入队，` +
          `${payload.summary.skippedExisting} 个已处理跳过`
      );
    } catch (err) {
      setPlanRunStatusTone("danger");
      setPlanRunStatus(err instanceof Error ? err.message : "计划执行失败");
    } finally {
      setPlanRunLoading(false);
    }
  };

  return (
    <div className="stack">
      <form className="card stack" onSubmit={onSubmit}>
        <div className="stack">
          <label className="stack">
            <span>Amazon URL</span>
            <input
              className="input"
              value={amazonUrl}
              onChange={(event) => setAmazonUrl(event.target.value)}
              placeholder="https://www.amazon.com/..."
              autoComplete="off"
              required
            />
          </label>
          <label className="stack">
            <span>Market Context</span>
            <input
              className="input"
              value={marketContext}
              onChange={(event) => handleMarketContextChange(event.target.value)}
              placeholder='{"locale":"en-US","country":"UNITED_STATES","brand":"WAYFAIR"}'
              autoComplete="off"
            />
          </label>
          <label className="stack">
            <span>Brand / Manufacturer</span>
            {brandsLoading ? (
              <div className="muted">Loading brands...</div>
            ) : brandsError ? (
              <div className="muted">{brandsError}</div>
            ) : (
              <select
                className="input"
                value={manufacturerId}
                onChange={(event) => setManufacturerId(event.target.value)}
              >
                <option value="">-- Select Brand --</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.manufacturer?.id ?? ""}>
                    {brand.manufacturer?.name ?? brand.manufacturer?.id ?? brand.id}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
        {error ? <div className="muted">{error}</div> : null}
        <button className="btn" type="submit" disabled={loading || !manufacturerId}>
          {loading ? "创建中..." : "创建 Run"}
        </button>
      </form>

      <div className="card stack">
        <strong>批量导入计划</strong>
        <div className="muted">上传计划仅覆盖保存，点击运行后才执行当天行。</div>
        <label className="stack">
          <span>Excel 文件</span>
          <input
            className="input"
            type="file"
            accept=".xlsx"
            onChange={(event) => setPlanFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="row">
          <button className="btn" type="button" onClick={onDownloadTemplate}>
            下载模板
          </button>
          <button
            className="btn"
            type="button"
            onClick={onImportPlan}
            disabled={planLoading}
          >
            {planLoading ? "导入中..." : "导入覆盖"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={onRunPlan}
            disabled={planRunLoading || !manufacturerId}
          >
            {planRunLoading ? "执行中..." : "运行计划"}
          </button>
        </div>
        {planStatus ? (
          <span
            className={`badge ${
              planStatusTone === "success"
                ? "badge-success"
                : planStatusTone === "danger"
                ? "badge-danger"
                : "badge-warning"
            }`}
          >
            {planStatus}
          </span>
        ) : null}
        {planRunStatus ? (
          <span
            className={`badge ${
              planRunStatusTone === "success"
                ? "badge-success"
                : planRunStatusTone === "danger"
                ? "badge-danger"
                : "badge-warning"
            }`}
          >
            {planRunStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}
