import Link from "next/link";
import { CreateRunForm } from "./components/CreateRunForm";
import { fetchJson } from "../lib/api";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export default async function HomePage() {
  const runs = await fetchJson<Run[]>("/api/runs");

  return (
    <div className="stack">
      <CreateRunForm />
      <div className="card stack">
        <div className="row">
          <strong>最近 Runs</strong>
          <span className="muted">{runs.length} 个</span>
        </div>
        {runs.length === 0 ? (
          <div className="muted">暂无 Run</div>
        ) : (
          runs.map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`}>
              <div className="row">
                <span className="badge">{run.status}</span>
                <span>{run.amazonUrl}</span>
                <span className="muted">{run.createdAt}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
