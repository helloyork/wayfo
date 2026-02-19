import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunEventStream } from "../../components/RunEventStream";
import { ReviewQueue } from "../../components/ReviewQueue";
import { StepOverview } from "../../components/StepOverview";

export const dynamic = "force-dynamic";

type RunDetail = {
  run: {
    id: string;
    amazonUrl: string;
    status: string;
    currentStep?: string;
    createdAt: string;
  };
  jobs: Array<{
    id: string;
    step: string;
    status: string;
    attempts: number;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    path: string;
    createdAt: string;
  }>;
};

export default async function RunDetailPage({
  params
}: {
  params: { runId: string };
}) {
  const detail = await fetchJson<RunDetail>(`/api/runs/${params.runId}`);
  const stepItems = [
    {
      title: "数据采集",
      status: detail.run.currentStep === "SCRAPE" ? "进行中" : "待执行",
      detail: "采集 Amazon 商品信息与图片，生成采集摘要。"
    },
    {
      title: "尺寸补全",
      status: detail.run.currentStep === "DIMENSION" ? "进行中" : "待执行",
      detail: "补全尺寸与规格，展示供应商查询状态。"
    },
    {
      title: "类目分类",
      status: detail.run.currentStep === "CLASSIFY" ? "进行中" : "待执行",
      detail: "向量检索 + 模型分类，展示候选 class。"
    },
    {
      title: "图片重绘",
      status: detail.run.currentStep === "IMAGE" ? "进行中" : "待执行",
      detail: "按批次策略生成候选，展示成本与结果。"
    },
    {
      title: "模板填充",
      status: detail.run.currentStep === "TEMPLATE" ? "进行中" : "待执行",
      detail: "解析模板字段并填充，展示缺失字段。"
    },
    {
      title: "审查与导出",
      status: detail.run.currentStep === "REVIEW" ? "待审查" : "待执行",
      detail: "人工确认后导出并上传，提供审查入口。"
    }
  ];

  return (
    <div className="stack">
      <div className="card stack">
        <Link href="/">返回</Link>
        <div className="row">
          <h2>Run {detail.run.id}</h2>
          <span className="badge">{detail.run.status}</span>
        </div>
        <div className="muted">{detail.run.amazonUrl}</div>
        <div className="muted">创建时间: {detail.run.createdAt}</div>
      </div>

      <StepOverview steps={stepItems} />

      <ReviewQueue
        items={[
          {
            title: "字段缺失",
            description: "显示缺失字段与建议值。",
            owner: `Run ${detail.run.id}`
          },
          {
            title: "图片候选",
            description: "展示主图/规格图候选选择。",
            owner: `Run ${detail.run.id}`
          },
          {
            title: "合规检查",
            description: "展示合规风险提示与确认记录。",
            owner: `Run ${detail.run.id}`
          }
        ]}
      />

      <RunEventStream runId={detail.run.id} />

      <div className="card stack">
        <strong>Jobs</strong>
        {detail.jobs.length === 0 ? (
          <div className="empty">暂无 Job</div>
        ) : (
          <div className="list">
            {detail.jobs.map((job) => (
              <div key={job.id} className="list-item">
                <div className="row">
                  <span className="badge">{job.status}</span>
                  <span>{job.step}</span>
                </div>
                <div className="muted">重试次数: {job.attempts}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
        <strong>Artifacts</strong>
        {detail.artifacts.length === 0 ? (
          <div className="empty">暂无产物</div>
        ) : (
          <div className="list">
            {detail.artifacts.map((artifact) => (
              <div key={artifact.id} className="list-item">
                <div className="row">
                  <span className="badge">{artifact.type}</span>
                  <span className="muted">{artifact.createdAt}</span>
                </div>
                <div className="muted">{artifact.path}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
