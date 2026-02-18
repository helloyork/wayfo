import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunEventStream } from "../../components/RunEventStream";

type RunDetail = {
  run: {
    id: string;
    amazonUrl: string;
    status: string;
    currentStep?: string;
    createdAt: string;
  };
  jobs: Array<{
    id: string;
    step: string;
    status: string;
    attempts: number;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    path: string;
    createdAt: string;
  }>;
};

export default async function RunDetailPage({
  params
}: {
  params: { runId: string };
}) {
  const detail = await fetchJson<RunDetail>(`/api/runs/${params.runId}`);

  return (
    <div className="stack">
      <div className="card stack">
        <Link href="/">返回</Link>
        <div className="row">
          <h2>Run {detail.run.id}</h2>
          <span className="badge">{detail.run.status}</span>
        </div>
        <div className="muted">{detail.run.amazonUrl}</div>
        <div className="muted">创建时间: {detail.run.createdAt}</div>
      </div>

      <RunEventStream runId={detail.run.id} />

      <div className="card stack">
        <strong>Jobs</strong>
        {detail.jobs.length === 0 ? (
          <div className="muted">暂无 Job</div>
        ) : (
          detail.jobs.map((job) => (
            <div key={job.id} className="row">
              <span className="badge">{job.status}</span>
              <span>{job.step}</span>
              <span className="muted">attempts: {job.attempts}</span>
            </div>
          ))
        )}
      </div>

      <div className="card stack">
        <strong>Artifacts</strong>
        {detail.artifacts.length === 0 ? (
          <div className="muted">暂无产物</div>
        ) : (
          detail.artifacts.map((artifact) => (
            <div key={artifact.id} className="row">
              <span className="badge">{artifact.type}</span>
              <span className="muted">{artifact.path}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
