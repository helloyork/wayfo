import Link from "next/link";

type RunItem = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export function RunList({
  runs,
  title
}: {
  runs: RunItem[];
  title: string;
}) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>{title}</strong>
        <span className="muted">{runs.length} 个</span>
      </div>
      {runs.length === 0 ? (
        <div className="empty">暂无 Run</div>
      ) : (
        <div className="list">
          {runs.map((run) => (
            <div key={run.id} className="list-item">
              <div className="row">
                <span className="badge">{run.status}</span>
                <strong>{run.id}</strong>
              </div>
              <div className="muted">{run.amazonUrl}</div>
              <div className="row">
                <span className="muted">{run.createdAt}</span>
                <Link href={`/runs/${run.id}`}>查看详情</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
