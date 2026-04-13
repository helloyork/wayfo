import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunDetailSectionNav } from "../../components/RunDetailSectionNav";
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

function extractAsinFromAmazonUrl(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m?.[1] ?? null;
}

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
  const needsReview =
    detail.run.status === "NEEDS_REVIEW" ||
    detail.run.status === "WAITING_FOR_REVIEW";
  const asin = extractAsinFromAmazonUrl(detail.run.amazonUrl);

  return (
    <div className="flex flex-col gap-6">
      <RunDetailSectionNav needsReview={needsReview} />

      <Card
        id="run-overview"
        className={`scroll-mt-24 shadow-sm ${isCompleted ? "border-primary/30" : ""}`}
      >
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/runs"
                className="text-sm font-medium text-primary hover:underline"
              >
                ← 全部批次
              </Link>
              {asin ? (
                <Link
                  href={`/products/${asin}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  产品总览 · {asin}
                </Link>
              ) : null}
            </div>
            <Badge variant={needsReview ? "default" : "secondary"} className="shrink-0">
              {detail.run.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">批次概览</CardTitle>
          </div>
          <CardDescription className="font-mono text-xs sm:text-sm">
            {detail.run.id}
          </CardDescription>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-border/80 bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Amazon
              </p>
              <a
                href={detail.run.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary hover:underline"
              >
                {detail.run.amazonUrl}
              </a>
            </div>
            <dl className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">创建时间</dt>
                <dd className="font-medium">{detail.run.createdAt}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Market Context</dt>
                <dd className="max-w-[min(100%,14rem)] truncate font-mono text-xs">
                  {detail.run.marketContext ?? "N/A"}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">变体枚举</dt>
                <dd className="font-medium">
                  {detail.run.enumerateVariants ? "开启" : "关闭"}
                </dd>
              </div>
            </dl>
          </div>
          {needsReview ? (
            <p className="mt-3 text-sm text-primary">
              当前需要人工确认或修正，请优先查看下方「Wayfair 审查」区块。
            </p>
          ) : null}
        </CardHeader>
      </Card>

      <RunProgressPanel
        id="run-progress"
        runId={detail.run.id}
        steps={stepItems.map((item) => ({ step: item.step, title: item.title }))}
        initialStatus={detail.run.status}
        initialStep={detail.run.currentStep}
      />

      <WayfairReviewPanel runId={detail.run.id} />

      <RunEventStream runId={detail.run.id} />

      <RunJobsPanel
        id="run-jobs"
        runId={detail.run.id}
        initialJobs={detail.jobs}
      />

      <Collapsible>
        <Card id="run-artifacts" className="scroll-mt-24 shadow-sm">
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
