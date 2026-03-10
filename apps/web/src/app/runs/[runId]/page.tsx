import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunJobsPanel } from "../../components/RunJobsPanel";
import { RunEventStream } from "../../components/RunEventStream";
import { RunProgressPanel } from "../../components/RunProgressPanel";
import { WayfairReviewPanel } from "../../components/WayfairReviewPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  params,
}: {
  params: { runId: string };
}) {
  const detail = await fetchJson<RunDetail>(`/api/runs/${params.runId}`);
  const stepItems = [
    {
      step: "SCRAPE_AMAZON",
      title: "数据采集",
      detail: "采集 Amazon 商品信息与图片，生成采集摘要。",
    },
    {
      step: "WAYFAIR_CLASSIFY",
      title: "类目分类",
      detail: "关键词召回 + 模型分类，输出 class 结果。",
    },
    {
      step: "WAYFAIR_DISCOVERY",
      title: "Wayfair Discovery",
      detail: "获取 questions、brand associations 与 media tags。",
    },
    {
      step: "WAYFAIR_SUBMIT",
      title: "Wayfair Submit",
      detail: "自动生成 answers 并提交 product addition。",
    },
    {
      step: "WAYFAIR_POLL",
      title: "Wayfair Poll",
      detail: "轮询 submissions 状态与 validationFlaws。",
    },
  ];

  const isCompleted = detail.run.status === "COMPLETED";

  return (
    <div className="flex flex-col gap-6">
      <Card
        className={`shadow-sm ${isCompleted ? "border-primary/30" : ""}`}
      >
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/runs"
              className="text-sm text-primary hover:underline"
            >
              返回
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Run 基础信息</CardTitle>
            <Badge variant="secondary">{detail.run.status}</Badge>
          </div>
          <CardDescription>Run ID: {detail.run.id}</CardDescription>
          <CardDescription>Amazon URL: {detail.run.amazonUrl}</CardDescription>
          <CardDescription>创建时间: {detail.run.createdAt}</CardDescription>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>
              Market Context: {detail.run.marketContext ?? "N/A"}
            </span>
            <span>
              变体枚举: {detail.run.enumerateVariants ? "开启" : "关闭"}
            </span>
          </div>
        </CardHeader>
      </Card>

      <RunProgressPanel
        runId={detail.run.id}
        steps={stepItems.map((item) => ({ step: item.step, title: item.title }))}
        initialStatus={detail.run.status}
        initialStep={detail.run.currentStep}
      />

      <WayfairReviewPanel runId={detail.run.id} />

      <RunEventStream runId={detail.run.id} />

      <RunJobsPanel runId={detail.run.id} initialJobs={detail.jobs} />

      <Collapsible>
        <Card className="shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Artifacts（折叠）</CardTitle>
                <CardDescription>{detail.artifacts.length} 个</CardDescription>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {detail.artifacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                  暂无产物
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {detail.artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{artifact.type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {artifact.createdAt}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {artifact.path}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
