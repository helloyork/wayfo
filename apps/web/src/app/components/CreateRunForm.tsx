"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Loader2 } from "lucide-react";
import { PlanTemplateDownloadDialog } from "./PlanTemplateDownloadDialog";
import { WayfairAgentModifiersDialog } from "./WayfairAgentModifiersDialog";

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
  dates?: string[];
  itemsByDate?: Record<string, PlanItem[]>;
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
  /** New run ids created in this plan-run invocation (same order as creation). */
  createdRunIds?: string[];
};

type PlanItem = {
  id: string;
  amazonUrl: string;
  sku?: string | null;
  partNumber?: string | null;
  upc?: string | null;
  planDate: string;
  isPrimary: boolean | number;
};

type PlanPreviewResponse = {
  timezone: string;
  today: string;
  dates: string[];
  itemsByDate: Record<string, PlanItem[]>;
};

type TaxonomyClassRow = {
  classId: string;
  name: string;
};

function badgeVariant(
  tone: "success" | "warning" | "danger"
): "success" | "warning" | "destructive" {
  if (tone === "success") return "success";
  if (tone === "danger") return "destructive";
  return "warning";
}

const YESTERDAY_ROWS = 5;
const FUTURE_ROWS = 5;

/** Actionable links after plan-run completes (batch closure). */
function PlanRunNextSteps({ createdRunIds }: { createdRunIds: string[] | null }) {
  if (createdRunIds === null) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-gradient-to-r from-primary/10 to-transparent px-3 py-2.5">
      <span className="text-sm font-medium text-foreground">下一步</span>
      {createdRunIds.length > 0 ? (
        <Button asChild size="sm" type="button">
          <Link href={`/runs/${createdRunIds[0]}`}>打开首个新批次</Link>
        </Button>
      ) : null}
      {createdRunIds.length > 1 ? (
        <span className="text-xs text-muted-foreground">
          另有 {createdRunIds.length - 1} 个新批次，可在列表中查看
        </span>
      ) : null}
      <Button asChild size="sm" variant="outline" type="button">
        <Link href="/runs">查看全部批次</Link>
      </Button>
    </div>
  );
}

function PlanPreviewTable({ data }: { data: PlanPreviewResponse }) {
  const { today, dates, itemsByDate } = data;
  const yesterdayKey = dates[0];
  const primary = (i: PlanItem) => i.isPrimary === true || i.isPrimary === 1;
  const pickItems = (arr: PlanItem[], filterPrimary: boolean) => {
    const filtered = filterPrimary ? arr.filter(primary) : arr;
    return filtered.length > 0 ? filtered : arr;
  };
  const todayItems = pickItems(itemsByDate[today] ?? [], true);
  const yesterdayItems = pickItems(itemsByDate[yesterdayKey] ?? [], true).slice(-YESTERDAY_ROWS);
  const futureDates = dates.filter((d) => d > today).slice(0, 3);
  const futureItems: PlanItem[] = [];
  for (const d of futureDates) {
    const items = pickItems(itemsByDate[d] ?? [], true);
    for (const item of items) {
      if (futureItems.length >= FUTURE_ROWS) break;
      futureItems.push(item);
    }
    if (futureItems.length >= FUTURE_ROWS) break;
  }

  const hasAny = yesterdayItems.length > 0 || todayItems.length > 0 || futureItems.length > 0;
  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        暂无计划数据，请先导入 Excel 计划表
      </div>
    );
  }

  const renderRow = (item: PlanItem, label: string, isToday: boolean) => (
    <tr
      key={item.id}
      className={`border-b border-border last:border-0 ${isToday ? "bg-primary/5" : ""}`}
    >
      <td className="py-2 pr-4 text-sm text-muted-foreground">{label}</td>
      <td className="py-2 pr-4 text-sm">
        <a
          href={item.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline truncate max-w-[200px] inline-block"
        >
          {item.amazonUrl}
        </a>
      </td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">{item.sku ?? "—"}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">{item.partNumber ?? "—"}</td>
      <td className="py-2 text-sm text-muted-foreground">{item.upc ?? "—"}</td>
    </tr>
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-sm font-medium">日期</th>
            <th className="px-4 py-2 text-sm font-medium">产品链接</th>
            <th className="px-4 py-2 text-sm font-medium">SKU</th>
            <th className="px-4 py-2 text-sm font-medium">Part Number</th>
            <th className="px-4 py-2 text-sm font-medium">UPC</th>
          </tr>
        </thead>
        <tbody>
          {yesterdayItems.map((item) => renderRow(item, `昨天 ${yesterdayKey}`, false))}
          {todayItems.map((item) => renderRow(item, `今天 ${today}`, true))}
          {futureItems.map((item) => renderRow(item, `未来 ${item.planDate}`, false))}
        </tbody>
      </table>
    </div>
  );
}

export function CreateRunForm({
  initialMarketContext,
  onMarketContextChange,
}: {
  initialMarketContext?: string;
  onMarketContextChange?: (value: string) => void;
}) {
  const router = useRouter();
  const [amazonUrl, setAmazonUrl] = useState("");
  const [marketContext, setMarketContext] = useState(() => {
    const raw = initialMarketContext?.trim() ?? "";
    if (!raw) return DEFAULT_MARKET_CONTEXT;
    const match = MARKET_CONTEXT_PRESETS.find((p) => {
      try {
        const a = JSON.parse(p.value) as { locale: string; country: string; brand: string };
        const b = JSON.parse(raw) as { locale?: string; country?: string; brand?: string };
        return a.locale === b.locale && a.country === b.country && a.brand === b.brand;
      } catch {
        return p.value === raw;
      }
    });
    return match?.value ?? DEFAULT_MARKET_CONTEXT;
  });
  const [manufacturerId, setManufacturerId] = useState("");
  const [brands, setBrands] = useState<BrandAssociation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [planStatusTone, setPlanStatusTone] = useState<
    "success" | "warning" | "danger"
  >("warning");
  const [planLoading, setPlanLoading] = useState(false);
  const [planRunStatus, setPlanRunStatus] = useState<string | null>(null);
  const [planRunStatusTone, setPlanRunStatusTone] = useState<
    "success" | "warning" | "danger"
  >("warning");
  const [planRunLoading, setPlanRunLoading] = useState(false);
  const [planRunCreatedIds, setPlanRunCreatedIds] = useState<string[] | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanPreviewResponse | null>(null);
  const [planPreviewLoading, setPlanPreviewLoading] = useState(false);
  const [taxonomyClasses, setTaxonomyClasses] = useState<TaxonomyClassRow[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [planTemplateDialogOpen, setPlanTemplateDialogOpen] = useState(false);
  const [planTemplateEntryLoading, setPlanTemplateEntryLoading] = useState(false);
  const [wayfairModifierDialogOpen, setWayfairModifierDialogOpen] = useState(false);
  const [globalModifierBlockCount, setGlobalModifierBlockCount] = useState(0);
  const planFileInputRef = useRef<HTMLInputElement>(null);

  const fetchGlobalModifierBlockCount = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/settings/app`, { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const payload = (await res.json()) as {
        agentModifiers?: { wayfairAnswers?: string[] };
      };
      const list = payload.agentModifiers?.wayfairAnswers ?? [];
      setGlobalModifierBlockCount(list.filter((s) => s.trim().length > 0).length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchGlobalModifierBlockCount();
  }, [fetchGlobalModifierBlockCount]);

  const onPlanTemplateDialogReady = useCallback(() => {
    setPlanTemplateEntryLoading(false);
  }, []);

  const fetchPlanPreview = useCallback(async () => {
    setPlanPreviewLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/runs/plan-preview?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as PlanPreviewResponse;
        setPlanPreview(data);
      } else {
        setPlanPreview(null);
      }
    } catch {
      setPlanPreview(null);
    } finally {
      setPlanPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanPreview();
  }, [fetchPlanPreview]);

  const fetchTaxonomyClasses = useCallback(async (mc: string) => {
    const trimmed = mc.trim();
    if (!trimmed) {
      setTaxonomyClasses([]);
      setTaxonomyError(null);
      return;
    }
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    try {
      const params = new URLSearchParams({ marketContext: trimmed });
      const res = await fetch(`${apiBase}/api/wayfair/taxonomy-classes?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "加载 taxonomy 类目失败");
      }
      const data = (await res.json()) as { classes: TaxonomyClassRow[] };
      setTaxonomyClasses(data.classes ?? []);
    } catch (err) {
      setTaxonomyError(err instanceof Error ? err.message : "加载 taxonomy 类目失败");
      setTaxonomyClasses([]);
    } finally {
      setTaxonomyLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTaxonomyClasses(marketContext);
  }, [marketContext, fetchTaxonomyClasses]);

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
      setBrandsError(
        err instanceof Error ? err.message : "Failed to fetch brands"
      );
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
    void fetchTaxonomyClasses(value);
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
        }),
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

  const onDownloadBaseTemplate = () => {
    window.location.href = `${apiBase}/api/runs/plan-template`;
  };

  const onImportPlan = async (file: File) => {
    setPlanLoading(true);
    setPlanStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (marketContext.trim()) {
        formData.append("marketContext", marketContext.trim());
      }
      if (manufacturerId) {
        formData.append("manufacturerId", manufacturerId);
      }
      const res = await fetch(`${apiBase}/api/runs/plan-import`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "计划导入失败");
      }
      const payload = (await res.json()) as PlanImportResponse;
      const errorCount = payload.errors.length;
      const activated = payload.summary.activatedRows;
      setPlanStatusTone(errorCount > 0 || activated === 0 ? "warning" : "success");
      let msg = `导入完成：${activated} 行生效`;
      if (errorCount > 0) msg += `（${errorCount} 行有错误）`;
      if (activated === 0 && payload.summary.validRows === 0) {
        msg +=
          "。请检查：1) 第 2 行为字段 id（含 amazonUrl、planDate）；2) 时间列为 MM-DD-YYYY；3) 产品链接非空";
      }
      setPlanStatus(msg);
      if (planFileInputRef.current) planFileInputRef.current.value = "";
      if (payload.dates && payload.itemsByDate) {
        setPlanPreview({
          timezone: payload.timezone,
          today: payload.today,
          dates: payload.dates,
          itemsByDate: payload.itemsByDate,
        });
      } else {
        fetchPlanPreview();
      }
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
    setPlanRunCreatedIds(null);
    try {
      const res = await fetch(`${apiBase}/api/runs/plan-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketContext: marketContext.trim(),
          manufacturerId: manufacturerId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "计划执行失败");
      }
      const payload = (await res.json()) as PlanRunResponse;
      setPlanRunCreatedIds(payload.createdRunIds ?? []);
      const created = payload.summary.createdRuns;
      if (created === 0) {
        setPlanRunStatusTone("warning");
        setPlanRunStatus(
          `未新建批次：今日计划行 ${payload.summary.planRows}，` +
            `已存在跳过 ${payload.summary.skippedExisting}，` +
            `非主行跳过 ${payload.summary.skippedSecondary}。可在「全部批次」核对或调整计划表后重试`
        );
      } else {
        setPlanRunStatusTone("success");
        setPlanRunStatus(
          `执行完成：${created} 个批次已创建并入队，` +
            `${payload.summary.skippedExisting} 个已存在跳过，` +
            `${payload.summary.skippedSecondary} 个非主行跳过`
        );
      }
      fetchPlanPreview();
    } catch (err) {
      setPlanRunStatusTone("danger");
      setPlanRunStatus(err instanceof Error ? err.message : "计划执行失败");
    } finally {
      setPlanRunLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>创建 Run</CardTitle>
            <CardDescription>输入 Amazon URL 或批量导入计划</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amazon-url">Amazon URL</Label>
              <Input
                id="amazon-url"
                value={amazonUrl}
                onChange={(e) => setAmazonUrl(e.target.value)}
                placeholder="https://www.amazon.com/..."
                autoComplete="off"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="market-context">Market Context</Label>
              <Select
                value={marketContext}
                onValueChange={(value) => handleMarketContextChange(value)}
              >
                <SelectTrigger id="market-context">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="brand">Brand / Manufacturer</Label>
              {brandsLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading brands...
                </div>
              ) : brandsError ? (
                <div className="text-sm text-muted-foreground">
                  {brandsError}
                </div>
              ) : (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={manufacturerId}
                  onChange={(e) => setManufacturerId(e.target.value)}
                >
                  <option value="">-- Select Brand --</option>
                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.manufacturer?.id ?? ""}
                    >
                      {brand.manufacturer?.name ??
                        brand.manufacturer?.id ??
                        brand.id}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={loading || !manufacturerId}>
                {loading ? "创建中..." : "创建 Run"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWayfairModifierDialogOpen(true)}
              >
                全局修改器…
              </Button>
              {globalModifierBlockCount > 0 ? (
                <span className="text-xs text-muted-foreground">
                  已保存 {globalModifierBlockCount} 条全局说明
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  未配置全局修改器
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>批量导入计划</CardTitle>
          <CardDescription>
            上传计划仅覆盖保存，点击运行后才执行当天行。Excel 需两行表头：第 1 行可读名（可留空），第 2
            行为字段 id。下载模板时在对话框中选择类目与题目列（与当前 Market Context 的 taxonomy
            一致）。多值可用 ; 或 | 分隔。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={planFileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportPlan(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setPlanTemplateEntryLoading(true);
                requestAnimationFrame(() => {
                  setPlanTemplateDialogOpen(true);
                });
              }}
              disabled={taxonomyLoading || planTemplateEntryLoading}
            >
              {planTemplateEntryLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  打开中…
                </>
              ) : (
                "下载计划模板…"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onDownloadBaseTemplate}>
              仅基础列
            </Button>
            <Button
              type="button"
              onClick={() => planFileInputRef.current?.click()}
              disabled={planLoading}
            >
              {planLoading ? "导入中..." : "导入覆盖"}
            </Button>
            <Button
              type="button"
              onClick={onRunPlan}
              disabled={planRunLoading || !manufacturerId}
            >
              {planRunLoading ? "执行中..." : "运行计划"}
            </Button>
          </div>

          {planPreviewLoading ? (
            <div className="text-sm text-muted-foreground">加载计划预览...</div>
          ) : planPreview ? (
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground">计划表预览</Label>
              <PlanPreviewTable data={planPreview} />
            </div>
          ) : null}

          {planStatus ? (
            <Badge variant={badgeVariant(planStatusTone)}>{planStatus}</Badge>
          ) : null}
          {planRunStatus ? (
            <div className="flex flex-col gap-3">
              <Badge variant={badgeVariant(planRunStatusTone)} className="w-fit">
                {planRunStatus}
              </Badge>
              <PlanRunNextSteps createdRunIds={planRunCreatedIds} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <WayfairAgentModifiersDialog
        open={wayfairModifierDialogOpen}
        onOpenChange={setWayfairModifierDialogOpen}
        apiBase={apiBase}
        onSaved={() => void fetchGlobalModifierBlockCount()}
      />

      <PlanTemplateDownloadDialog
        open={planTemplateDialogOpen}
        onOpenChange={(open) => {
          setPlanTemplateDialogOpen(open);
          if (!open) setPlanTemplateEntryLoading(false);
        }}
        marketContext={marketContext}
        apiBase={apiBase}
        taxonomyClasses={taxonomyClasses}
        taxonomyLoading={taxonomyLoading}
        taxonomyError={taxonomyError}
        onPlanStatus={(message, tone) => {
          setPlanStatusTone(tone);
          setPlanStatus(message);
        }}
        onDownloadBaseTemplate={onDownloadBaseTemplate}
        onAfterOpen={onPlanTemplateDialogReady}
      />
    </div>
  );
}
