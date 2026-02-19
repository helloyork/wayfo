import { CreateRunForm } from "../components/CreateRunForm";
import { RunList } from "../components/RunList";
import { fetchJson } from "../../lib/api";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export default async function RunsPage() {
  const runs = await fetchJson<Run[]>("/api/runs");

  return (
    <div className="stack">
      <div>
        <h2>Runs</h2>
        <div className="muted">查看所有执行记录与状态</div>
      </div>
      <CreateRunForm />
      <RunList runs={runs} title="全部 Runs" />
    </div>
  );
}
