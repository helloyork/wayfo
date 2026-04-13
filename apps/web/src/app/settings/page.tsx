import { HasDataSettings } from "../components/HasDataSettings";
import { OpenAiSettings } from "../components/OpenAiSettings";
import { R2Settings } from "../components/R2Settings";
import { WayfairSettings } from "../components/WayfairSettings";
import { RunDefaultsSettings } from "../components/RunDefaultsSettings";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">设置</h2>
          <p className="text-sm text-muted-foreground">
            连接器与默认配置；修改后返回主界面或批次页继续创建 Run
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HasDataSettings />
        <OpenAiSettings />
        <R2Settings />
        <WayfairSettings />
        <RunDefaultsSettings />
      </div>
    </div>
  );
}
