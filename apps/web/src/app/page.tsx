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
  const runs = await fetchJson<Run[]>("/api/runs");
  const activeRun = runs[0];
  const recentRuns = runs.slice(0, 10);

  return (
    <div className="stack">
      <div className="row">
        <div className="page-header">
          <h2>主界面</h2>
          <div className="muted">概览、Run 创建与最近执行</div>
        </div>
        <Link href="/runs" className="muted">
          查看全部 Runs
        </Link>
      </div>

      <DashboardStats
        items={[
          { label: "总 Runs", value: String(runs.length) },
          {
            label: "活跃 Run",
            value: activeRun ? "1" : "0",
            hint: activeRun ? `当前: ${activeRun.id}` : "暂无"
          },
          { label: "最近 10 个", value: String(recentRuns.length) }
        ]}
      />

      <RunEntryGate />
      <RunList runs={recentRuns} title="最近 10 个 Run" />
    </div>
  );
}
