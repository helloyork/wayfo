import { HasDataSettings } from "../components/HasDataSettings";

export default function SettingsPage() {
  return (
    <div className="stack">
      <div className="page-header">
        <h2>设置</h2>
        <div className="muted">连接器、鉴权与可观测性</div>
      </div>
      <div className="grid-2">
        <HasDataSettings />
        <div className="card stack">
          <strong>连接器配置</strong>
          <div className="muted">占位：Amazon / Wayfair / Supplier</div>
          <div className="empty">请在此处配置连接器开关与限流。</div>
        </div>
        <div className="card stack">
          <strong>AI Gateway</strong>
          <div className="muted">占位：模型路由、预算与重试</div>
          <div className="empty">请在此处配置模型与成本上限。</div>
        </div>
        <div className="card stack">
          <strong>存储与日志</strong>
          <div className="muted">占位：artifact 路径与日志等级</div>
          <div className="empty">请在此处配置本地存储与日志输出。</div>
        </div>
      </div>
    </div>
  );
}
