import { HasDataSettings } from "../components/HasDataSettings";
import { OpenAiSettings } from "../components/OpenAiSettings";
import { WayfairSettings } from "../components/WayfairSettings";
import { RunDefaultsSettings } from "../components/RunDefaultsSettings";

export default function SettingsPage() {
  return (
    <div className="stack">
      <div className="page-header">
        <h2>设置</h2>
        <div className="muted">连接器与默认配置</div>
      </div>
      <div className="grid-2">
        <HasDataSettings />
        <OpenAiSettings />
        <WayfairSettings />
        <RunDefaultsSettings />
      </div>
    </div>
  );
}
