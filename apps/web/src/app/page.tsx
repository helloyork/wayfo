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

  const activeRun = runs[0];
  const recentRuns = runs.slice(0, 10);

  if (apiError) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">主界面</h2>
          <p className="text-sm text-muted-foreground">
            概览、Run 创建与最近执行
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
            概览、Run 创建与最近执行
          </p>
        </div>
        <Link
          href="/runs"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          查看全部 Runs
        </Link>
      </div>

      <DashboardStats
        items={[
          { label: "总 Runs", value: String(runs.length) },
          {
            label: "活跃 Run",
            value: activeRun ? "1" : "0",
            hint: activeRun ? `当前: ${activeRun.id}` : "暂无",
          },
          { label: "最近 10 个", value: String(recentRuns.length) },
        ]}
      />

      <RunEntryGate />
      <RunList runs={recentRuns} title="最近 10 个 Run" showViewAllLink />
    </div>
  );
}
