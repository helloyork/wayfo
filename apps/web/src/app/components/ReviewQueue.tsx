type ReviewItem = {
  title: string;
  description: string;
  owner: string;
};

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>待审查</strong>
        <span className="muted">人工确认入口占位</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">暂无待审查项</div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <div key={item.title} className="list-item">
              <div className="row">
                <span className="badge badge-warning">需要确认</span>
                <span>{item.title}</span>
              </div>
              <div className="muted">{item.description}</div>
              <div className="muted">归属: {item.owner}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
