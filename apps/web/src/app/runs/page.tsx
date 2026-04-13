import Link from "next/link";
import { RunEntryGate } from "../components/RunEntryGate";
import { RunList } from "../components/RunList";
import { fetchJson } from "../../lib/api";

export const dynamic = "force-dynamic";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export default async function RunsPage() {
  const runs = await fetchJson<Run[]>("/api/runs");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">全部批次</h2>
          <p className="text-sm text-muted-foreground">
            管理全部 Run、创建新批次与计划；摘要与快捷入口见主界面
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          返回主界面
        </Link>
      </div>

      <RunEntryGate />
      <RunList runs={runs} title="全部 Run" />
    </div>
  );
}
