import Link from "next/link";
import { RunEntryGate } from "./components/RunEntryGate";
import { DashboardStats } from "./components/DashboardStats";
import { ReviewQueue } from "./components/ReviewQueue";
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
  const reviewItems = activeRun
    ? [
        {
          title: "字段缺失",
          description: "展示缺失字段列表与建议值。",
          owner: `Run ${activeRun.id}`
        },
        {
          title: "图片候选",
          description: "展示主图/规格图候选选择。",
          owner: `Run ${activeRun.id}`
        }
      ]
    : [];

  return (
    <div className="stack">
      <div className="row">
        <div className="page-header">
          <h2>Dashboard</h2>
          <div className="muted">任务监控与审查入口</div>
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
          { label: "待审查", value: reviewItems.length.toString() }
        ]}
      />

      <RunEntryGate />
      <ReviewQueue items={reviewItems} />
      <RunList runs={runs} title="最近 Runs" />
    </div>
  );
}
