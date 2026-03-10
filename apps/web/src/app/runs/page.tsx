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
          <h2 className="text-2xl font-semibold tracking-tight">批次</h2>
          <p className="text-sm text-muted-foreground">全部 Run 列表</p>
        </div>
      </div>

      <RunEntryGate />
      <RunList runs={runs} title="全部 Run" />
    </div>
  );
}
