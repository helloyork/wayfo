import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunEventStream } from "../../components/RunEventStream";
import { ReviewQueue } from "../../components/ReviewQueue";
import { StepOverview } from "../../components/StepOverview";
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
  const jobStatusCounts = detail.jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});
  const artifactTypeCounts = detail.artifacts.reduce<Record<string, number>>((acc, artifact) => {
    acc[artifact.type] = (acc[artifact.type] ?? 0) + 1;
    return acc;
  }, {});
  const currentStep = detail.run.currentStep;
  const runStatus = detail.run.status;
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
  ].map((item) => {
    if (runStatus === "COMPLETED") {
      return { title: item.title, detail: item.detail, status: "完成", badgeTone: "success" as const };
    }
    if (runStatus === "NEEDS_REVIEW" || runStatus === "WAITING_FOR_REVIEW") {
      return {
        title: item.title,
        detail: item.detail,
        status: item.step === currentStep ? "需要审查" : "待执行",
        badgeTone: item.step === currentStep ? ("warning" as const) : undefined
      };
    }
    if (item.step === currentStep) {
      return { title: item.title, detail: item.detail, status: "进行中", badgeTone: "warning" as const };
    }
    return { title: item.title, detail: item.detail, status: "待执行" };
  });

  const reviewItems =
    runStatus === "NEEDS_REVIEW" || runStatus === "WAITING_FOR_REVIEW"
      ? [
          {
            title: "Wayfair ValidationFlaws",
            description: "需要人工确认并修正后重新提交。",
            owner: `Run ${detail.run.id}`
          }
        ]
      : [];

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
        <div className="row muted" style={{ gap: 12 }}>
          <span>当前步骤: {detail.run.currentStep ?? "N/A"}</span>
          <span>Market Context: {detail.run.marketContext ?? "N/A"}</span>
          <span>变体枚举: {detail.run.enumerateVariants ? "开启" : "关闭"}</span>
        </div>
      </div>

      <div className="card stack">
        <strong>执行摘要</strong>
        <div className="row muted" style={{ gap: 12 }}>
          <span>Jobs: {detail.jobs.length}</span>
          <span>Artifacts: {detail.artifacts.length}</span>
        </div>
        <div className="row muted" style={{ gap: 12 }}>
          {Object.keys(jobStatusCounts).length === 0
            ? "暂无 Job"
            : Object.entries(jobStatusCounts).map(([status, count]) => (
                <span key={status}>
                  {status}: {count}
                </span>
              ))}
        </div>
        <div className="row muted" style={{ gap: 12, flexWrap: "wrap" }}>
          {Object.keys(artifactTypeCounts).length === 0
            ? "暂无产物"
            : Object.entries(artifactTypeCounts).map(([type, count]) => (
                <span key={type}>
                  {type}: {count}
                </span>
              ))}
        </div>
      </div>

      <StepOverview steps={stepItems} />

      <ReviewQueue items={reviewItems} />

      <WayfairReviewPanel runId={detail.run.id} />

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
