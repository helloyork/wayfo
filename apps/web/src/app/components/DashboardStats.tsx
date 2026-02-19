type StatItem = {
  label: string;
  value: string;
  hint?: string;
};

export function DashboardStats({ items }: { items: StatItem[] }) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>概览</strong>
        <span className="muted">本地运行与任务概况</span>
      </div>
      <div className="grid-3">
        {items.map((item) => (
          <div key={item.label} className="stat">
            <span className="stat-label">{item.label}</span>
            <span className="stat-value">{item.value}</span>
            {item.hint ? <span className="muted">{item.hint}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
