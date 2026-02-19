import Link from "next/link";
import { CreateRunForm } from "./components/CreateRunForm";
import { ActivityLog } from "./components/ActivityLog";
import { ComplianceStatus } from "./components/ComplianceStatus";
import { DashboardStats } from "./components/DashboardStats";
import { PoolStatus } from "./components/PoolStatus";
import { ReviewQueue } from "./components/ReviewQueue";
import { RunList } from "./components/RunList";
import { StepOverview } from "./components/StepOverview";
import { fetchJson } from "../lib/api";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export default async function HomePage() {
  const runs = await fetchJson<Run[]>("/api/runs");
  const activeRun = runs[0];
  const stepItems = [
    {
      title: "数据采集",
      status: "等待输入",
      detail: "输入 Amazon 链接后启动采集，占位显示采集结果摘要。"
    },
    {
      title: "尺寸补全",
      status: "待执行",
      detail: "缺失尺寸时以 ASIN 查询供应商 API，占位显示补全状态。"
    },
    {
      title: "类目分类",
      status: "待执行",
      detail: "向量检索 + 模型判断 class，占位显示候选与置信度。"
    },
    {
      title: "图片重绘",
      status: "待计划",
      detail: "按类型与批次策略生成候选图，占位显示批次与成本。"
    },
    {
      title: "模板填充",
      status: "待执行",
      detail: "解析 Wayfair 模板并填充字段，占位显示缺失字段。"
    },
    {
      title: "审查与导出",
      status: "待审查",
      detail: "用户确认字段与图片后导出并上传，占位显示审核入口。"
    }
  ];
  const reviewItems = activeRun
    ? [
        {
          title: "字段缺失",
          description: "展示缺失字段列表与建议值占位。",
          owner: `Run ${activeRun.id}`
        },
        {
          title: "图片候选",
          description: "展示主图/规格图候选选择占位。",
          owner: `Run ${activeRun.id}`
        }
      ]
    : [];
  const activityItems = [
    {
      id: "evt-1",
      time: "09:10",
      message: "等待新的 Run 创建与采集任务启动。",
      tag: "RUN"
    },
    {
      id: "evt-2",
      time: "09:20",
      message: "结构化日志将显示在此处，占位示例。",
      tag: "LOG"
    }
  ];
  const poolItems = [
    {
      name: "Browser Pool",
      status: "就绪",
      detail: "占位显示并发、会话隔离与队列长度。"
    },
    {
      name: "Model Call Pool",
      status: "限制中",
      detail: "占位显示预算、速率限制与重试策略。"
    },
    {
      name: "Batch Queue",
      status: "空闲",
      detail: "占位显示批次任务与成本汇总。"
    }
  ];
  const complianceItems = [
    {
      title: "图片合规",
      detail: "占位展示水印/商标检测与拦截记录。"
    },
    {
      title: "文案合规",
      detail: "占位展示禁用词与夸大描述检查。"
    }
  ];

  return (
    <div className="stack">
      <div className="row">
        <div className="page-header">
          <h2>Dashboard</h2>
          <div className="muted">任务监控、审查与日志入口</div>
        </div>
        <Link href="/runs" className="muted">
          查看全部 Runs
        </Link>
      </div>

      <DashboardStats
        items={[
          { label: "总 Runs", value: String(runs.length) },
          {
            label: "活跃 Run",
            value: activeRun ? "1" : "0",
            hint: activeRun ? `当前: ${activeRun.id}` : "暂无"
          },
          { label: "待审查", value: reviewItems.length.toString() }
        ]}
      />

      <div className="split">
        <div className="stack">
          <CreateRunForm />
          <StepOverview steps={stepItems} />
          <PoolStatus items={poolItems} />
        </div>
        <div className="stack">
          <ReviewQueue items={reviewItems} />
          <ComplianceStatus items={complianceItems} />
          <ActivityLog items={activityItems} />
        </div>
      </div>

      <RunList runs={runs} title="最近 Runs" />
    </div>
  );
}
