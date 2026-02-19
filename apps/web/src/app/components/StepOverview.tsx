type StepItem = {
  title: string;
  status: string;
  detail: string;
  badgeTone?: "success" | "warning" | "danger";
};

const toneClassMap = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger"
} as const;

export function StepOverview({ steps }: { steps: StepItem[] }) {
  return (
    <div className="card stack">
      <div className="row">
        <strong>流程步骤</strong>
        <span className="muted">按架构步骤展示</span>
      </div>
      <div className="list">
        {steps.map((step) => {
          const toneClass = step.badgeTone
            ? toneClassMap[step.badgeTone]
            : "";
          return (
            <div key={step.title} className="list-item">
              <div className="row">
                <span className={`badge ${toneClass}`}>{step.status}</span>
                <span>{step.title}</span>
              </div>
              <div className="muted">{step.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
