import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { RunEventStream } from "../../components/RunEventStream";
import { ReviewQueue } from "../../components/ReviewQueue";
import { StepDetailCard } from "../../components/StepDetailCard";
import { StepOverview } from "../../components/StepOverview";

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
      detail: "采集 Amazon 商品信息与图片，占位显示采集摘要。"
    },
    {
      title: "尺寸补全",
      status: detail.run.currentStep === "DIMENSION" ? "进行中" : "待执行",
      detail: "补全尺寸与规格，占位显示供应商查询状态。"
    },
    {
      title: "类目分类",
      status: detail.run.currentStep === "CLASSIFY" ? "进行中" : "待执行",
      detail: "向量检索 + 模型分类，占位显示候选 class。"
    },
    {
      title: "图片重绘",
      status: detail.run.currentStep === "IMAGE" ? "进行中" : "待执行",
      detail: "按批次策略生成候选，占位显示成本与结果。"
    },
    {
      title: "模板填充",
      status: detail.run.currentStep === "TEMPLATE" ? "进行中" : "待执行",
      detail: "解析模板字段并填充，占位显示缺失字段。"
    },
    {
      title: "审查与导出",
      status: detail.run.currentStep === "REVIEW" ? "待审查" : "待执行",
      detail: "人工确认后导出并上传，占位显示审查入口。"
    }
  ];
  const stepDetails = [
    {
      title: "1. 数据采集",
      status: "占位",
      summary: "采集产品信息、变体、图片与价格，写入本地缓存。",
      placeholders: [
        "输入: Amazon URL / 账号上下文",
        "输出: product.json / images/* / logs/*.log",
        "状态: 进度、失败重试、断点续跑占位"
      ]
    },
    {
      title: "1.1 尺寸补全",
      status: "占位",
      summary: "当尺寸缺失时用 ASIN 查询供应商 API。",
      placeholders: [
        "输入: ASIN / 缺失字段列表",
        "输出: dimension.json",
        "提示: 失败后进入需要人工处理"
      ]
    },
    {
      title: "1.2 类目分类",
      status: "占位",
      summary: "向量检索 + 模型判断 class 与置信度。",
      placeholders: [
        "输入: 标题/描述/候选 class",
        "输出: class.json (data/confidence/evidence)",
        "人审: 展示候选列表与证据"
      ]
    },
    {
      title: "2. 图片类型识别",
      status: "占位",
      summary: "对图片类型进行分类（主图/规格/卖点/场景）。",
      placeholders: [
        "输入: 原图列表",
        "输出: classification.json",
        "策略: 可扩展类型 registry"
      ]
    },
    {
      title: "2.2 重绘计划",
      status: "占位",
      summary: "根据类型与策略生成批次计划。",
      placeholders: [
        "输入: 图片类型与策略配置",
        "输出: generation-plan.json",
        "策略: 批次与候选数量占位"
      ]
    },
    {
      title: "2.3 图片重绘",
      status: "占位",
      summary: "按计划批量生成候选图并选择默认。",
      placeholders: [
        "输入: 原图 + 生成计划",
        "输出: generated/* + selection.json",
        "人审: 主图/规格图候选切换"
      ]
    },
    {
      title: "3. 模板下载与字段解析",
      status: "占位",
      summary: "下载 Wayfair 模板并解析字段。",
      placeholders: [
        "输入: class / 模板 API",
        "输出: template.xlsx / fields.json",
        "字段: 下拉框选项占位"
      ]
    },
    {
      title: "3.1 模板填充",
      status: "占位",
      summary: "模型填充字段并输出 JSON。",
      placeholders: [
        "输入: 产品完整信息与字段定义",
        "输出: filled.json / missing-fields.json",
        "提示: 缺失字段进入审查队列"
      ]
    },
    {
      title: "4. 审查与导出",
      status: "占位",
      summary: "人工确认后生成最终 xlsx 并上传。",
      placeholders: [
        "输入: 审查选择 + 补充字段",
        "输出: final.xlsx / upload-result.json",
        "失败: 可重试与错误建议占位"
      ]
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

      <div className="split">
        <div className="stack">
          <StepOverview steps={stepItems} />
          <div className="card stack">
            <div className="row">
              <strong>运行控制</strong>
              <span className="muted">暂停 / 继续 / 取消占位</span>
            </div>
            <div className="row">
              <button className="btn" type="button" disabled>
                暂停
              </button>
              <button className="btn" type="button" disabled>
                继续
              </button>
              <button className="btn" type="button" disabled>
                取消
              </button>
            </div>
            <div className="muted">
              这些操作会与 Orchestrator 状态机联动（占位）。
            </div>
          </div>
          <RunEventStream runId={detail.run.id} />
        </div>
        <ReviewQueue
          items={[
            {
              title: "字段缺失",
              description: "占位显示缺失字段与建议值。",
              owner: `Run ${detail.run.id}`
            },
            {
              title: "图片候选",
              description: "占位展示主图/规格图候选选择。",
              owner: `Run ${detail.run.id}`
            },
            {
              title: "合规检查",
              description: "占位展示合规风险提示与确认记录。",
              owner: `Run ${detail.run.id}`
            }
          ]}
        />
      </div>

      <div className="grid-2">
        {stepDetails.map((step) => (
          <StepDetailCard key={step.title} step={step} />
        ))}
      </div>

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
