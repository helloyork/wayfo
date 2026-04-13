import Link from "next/link";
import { RunEntryGate } from "./components/RunEntryGate";
import { DashboardStats } from "./components/DashboardStats";
import { RunList } from "./components/RunList";
import { fetchJson } from "../lib/api";

export const dynamic = "force-dynamic";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export default async function HomePage() {
  let runs: Run[] = [];
  let apiError: string | null = null;
  try {
    runs = await fetchJson<Run[]>("/api/runs");
  } catch (err) {
    apiError =
      err instanceof Error ? err.message : "无法连接后端服务，请确认 Wayfo 服务已启动";
  }

  const recentRuns = runs.slice(0, 10);
  const terminalStatuses = new Set(["COMPLETED", "CANCELLED", "FAILED"]);
  const inProgressCount = runs.filter((r) => !terminalStatuses.has(r.status)).length;
  const needsReviewCount = runs.filter(
    (r) => r.status === "NEEDS_REVIEW" || r.status === "WAITING_FOR_REVIEW"
  ).length;

  if (apiError) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">主界面</h2>
          <p className="text-sm text-muted-foreground">
            今日摘要与创建入口；后端未连接时请先启动服务
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">后端服务未连接</p>
          <p className="mt-1 text-sm">{apiError}</p>
          <p className="mt-2 text-sm">
            请使用 <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">wayfo launch --dev</code> 启动完整服务。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">主界面</h2>
          <p className="text-sm text-muted-foreground">
            今日摘要、创建 Run 与最近批次；完整列表请用侧栏「批次」或顶栏快捷入口
          </p>
        </div>
        <Link
          href="/runs"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          全部批次
        </Link>
      </div>

      <DashboardStats
        items={[
          { label: "总批次", value: String(runs.length) },
          {
            label: "进行中",
            value: String(inProgressCount),
            hint: "未处于已完成 / 已取消 / 失败的批次",
          },
          {
            label: "待审查",
            value: String(needsReviewCount),
            hint:
              needsReviewCount > 0
                ? "请从下方列表或「全部批次」打开对应 Run 处理 Wayfair 审查"
                : "暂无需要人工审查的批次",
          },
        ]}
      />

      <RunEntryGate />
      <RunList runs={recentRuns} title="最近 10 个批次" showViewAllLink />
    </div>
  );
}
