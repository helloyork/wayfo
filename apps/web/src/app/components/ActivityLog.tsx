type ActivityItem = {
  id: string;
  time: string;
  message: string;
  tag?: string;
};

export function ActivityLog({ items }: { items: ActivityItem[] }) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>日志与事件</strong>
        <span className="muted">结构化日志</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">暂无日志</div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <div key={item.id} className="list-item">
              <div className="row">
                {item.tag ? <span className="badge">{item.tag}</span> : null}
                <span className="muted">{item.time}</span>
              </div>
              <div>{item.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
