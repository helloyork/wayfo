type PoolItem = {
  name: string;
  status: string;
  detail: string;
};

export function PoolStatus({ items }: { items: PoolItem[] }) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>资源池与批次</strong>
        <span className="muted">并发与成本控制</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">暂无池/批次信息</div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <div key={item.name} className="list-item">
              <div className="row">
                <span className="badge">{item.status}</span>
                <span>{item.name}</span>
              </div>
              <div className="muted">{item.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
