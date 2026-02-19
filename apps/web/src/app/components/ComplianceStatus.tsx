type ComplianceItem = {
  title: string;
  detail: string;
};

export function ComplianceStatus({ items }: { items: ComplianceItem[] }) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>安全与合规</strong>
        <span className="muted">脱敏与审核占位</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">暂无合规提示</div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <div key={item.title} className="list-item">
              <div className="row">
                <span className="badge badge-warning">待确认</span>
                <span>{item.title}</span>
              </div>
              <div className="muted">{item.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
