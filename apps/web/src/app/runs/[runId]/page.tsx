import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunJobsPanel } from "../../components/RunJobsPanel";
import { RunEventStream } from "../../components/RunEventStream";
import { RunProgressPanel } from "../../components/RunProgressPanel";
import { WayfairReviewPanel } from "../../components/WayfairReviewPanel";

export const dynamic = "force-dynamic";

type RunDetail = {
  run: {
    id: string;
    amazonUrl: string;
    status: string;
    currentStep?: string;
    marketContext?: string;
    enumerateVariants?: boolean;
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
      step: "SCRAPE_AMAZON",
      title: "数据采集",
      detail: "采集 Amazon 商品信息与图片，生成采集摘要。"
    },
    {
      step: "WAYFAIR_CLASSIFY",
      title: "类目分类",
      detail: "关键词召回 + 模型分类，输出 class 结果。"
    },
    {
      step: "WAYFAIR_DISCOVERY",
      title: "Wayfair Discovery",
      detail: "获取 questions、brand associations 与 media tags。"
    },
    {
      step: "WAYFAIR_SUBMIT",
      title: "Wayfair Submit",
      detail: "自动生成 answers 并提交 product addition。"
    },
    {
      step: "WAYFAIR_POLL",
      title: "Wayfair Poll",
      detail: "轮询 submissions 状态与 validationFlaws。"
    }
  ];

  return (
    <div className="stack">
      <div className={`card stack${detail.run.status === "COMPLETED" ? " card-success" : ""}`}>
        <Link href="/runs">返回</Link>
        <div className="row">
          <h2>Run 基础信息</h2>
          <span className="badge">{detail.run.status}</span>
        </div>
        <div className="muted">Run ID: {detail.run.id}</div>
        <div className="muted">Amazon URL: {detail.run.amazonUrl}</div>
        <div className="muted">创建时间: {detail.run.createdAt}</div>
        <div className="row muted">
          <span>Market Context: {detail.run.marketContext ?? "N/A"}</span>
          <span>变体枚举: {detail.run.enumerateVariants ? "开启" : "关闭"}</span>
        </div>
      </div>

      <RunProgressPanel
        runId={detail.run.id}
        steps={stepItems.map((item) => ({ step: item.step, title: item.title }))}
        initialStatus={detail.run.status}
        initialStep={detail.run.currentStep}
      />

      <WayfairReviewPanel runId={detail.run.id} />

      <RunEventStream runId={detail.run.id} />

      <RunJobsPanel runId={detail.run.id} initialJobs={detail.jobs} />

      <details className="card stack">
        <summary className="row">
          <strong>Artifacts（折叠）</strong>
          <span className="muted">{detail.artifacts.length} 个</span>
        </summary>
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
      </details>
    </div>
  );
}
