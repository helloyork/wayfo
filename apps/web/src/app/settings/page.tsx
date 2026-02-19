import { HasDataSettings } from "../components/HasDataSettings";
import { RunDefaultsSettings } from "../components/RunDefaultsSettings";

export default function SettingsPage() {
  return (
    <div className="stack">
      <div className="page-header">
        <h2>设置</h2>
        <div className="muted">连接器、鉴权与可观测性</div>
      </div>
      <div className="grid-2">
        <HasDataSettings />
        <RunDefaultsSettings />
        <div className="card stack">
          <strong>AI Gateway</strong>
          <div className="muted">模型路由、预算与重试</div>
          <div className="empty">请在此处配置模型与成本上限。</div>
        </div>
        <div className="card stack">
          <strong>存储与日志</strong>
          <div className="muted">artifact 路径与日志等级</div>
          <div className="empty">请在此处配置本地存储与日志输出。</div>
        </div>
      </div>
    </div>
  );
}
