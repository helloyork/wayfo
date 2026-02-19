type StepDetail = {
  title: string;
  summary: string;
  placeholders: string[];
  status?: string;
};

export function StepDetailCard({ step }: { step: StepDetail }) {
  return (
    <div className="card stack">
      <div className="row">
        {step.status ? <span className="badge">{step.status}</span> : null}
        <strong>{step.title}</strong>
      </div>
      <div className="muted">{step.summary}</div>
      <div className="list">
        {step.placeholders.map((item) => (
          <div key={item} className="list-item">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
