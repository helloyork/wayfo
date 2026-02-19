---
name: wayfo-implementation-guide
overview: 基于 project/architecture.md 与 Wayfair Catalog/Product Addition GraphQL 文档，规划一个 local-first 的 Node.js 后端 + 本地 NextJS 前端的落地实现方案：分层可测、Run/Job/Artifact 可恢复、Pool/Batch 并发可控、Human-in-the-loop 审查闭环、Wayfair Catalog API 全流程对接。
todos:
  - id: workspace_scaffold
    content: 初始化 monorepo：apps/server（Node API + orchestrator）/apps/web（NextJS UI）/packages/shared（schemas/types）与一键启动 CLI。
    status: completed
  - id: core_models_storage
    content: 实现 Run/Job/Artifact 模型、文件系统 artifact store、SQLite 索引、幂等键与断点续跑读取策略。
    status: pending
  - id: events_api
    content: 实现 REST + SSE 事件协议、统一错误结构、结构化日志（终端+JSONL）。
    status: pending
  - id: pools_batches
    content: 实现 Browser/Wayfair/Model/Image pools 与 Batch 执行框架（并发、预算、重试、取消传播）。
    status: pending
  - id: wayfair_auth_connector
    content: 实现 Wayfair OAuth token 获取与缓存/刷新（sandbox+prod），GraphQL client 与基础错误处理。
    status: pending
  - id: wayfair_shared_types
    content: 在 packages/shared 固化 Wayfair GraphQL 的核心 types + zod schema（marketContext/questions/answers/submit/submissions/validationFlaws），并提供 request/response 的最小封装，供 server/web/orchestrator 共享。
    status: pending
  - id: wayfair_product_addition_flow
    content: 实现 discovery（taxonomyCategories/questions/brandAssociations/mediaMetaDataTags）→ submit → submissions poll → validationFlaws 解析 → NEEDS_REVIEW → resubmit。
    status: pending
  - id: amazon_connector
    content: 实现基于 HasData 的 Amazon 商品数据采集 + 缓存落盘（按 ASIN 幂等）+ 变体枚举可配置（默认关闭，仅处理输入 ASIN）+ 失败降级/人审闭环。
    status: pending
  - id: ai_gateway_embeddings_classify
    content: 实现 OpenAI embedding + 本地向量索引 + class 候选检索 + LLM 最终分类（规范化输出与 repair）。
    status: pending
  - id: image_pipeline
    content: 实现图片类型识别、generation plan、重绘批次执行、候选默认选择与人审切换（provider 可插拔）。
    status: pending
  - id: next_ui
    content: 实现 NextJS UI：Run 创建/列表/详情、实时日志、artifact 浏览、Wayfair questions 审查表单、设置页（验证凭据）。
    status: pending
  - id: docs_update_architecture
    content: 更新 project/architecture.md：反映 Wayfair Catalog/Product Addition GraphQL 流程替代 xlsx 模板流程。
    status: completed
isProject: false
---

## 总览

- 目标是落地一个“本地一键启动”的系统：**Node.js 服务端（编排+连接器+存储+事件）** + **NextJS 前端（输入、进度、日志、产物、人审）**。
- 后端遵循 `Run/Job/Artifact`、幂等与断点续跑、结构化日志、Pool/Batch 资源控制。
- Wayfair 侧改为 **Catalog API（supplier-catalog-api）+ Product Addition（product-catalog-api）** 的 GraphQL 工作流，不再依赖 xlsx 模板填充。

## 推荐仓库结构（workspaces）

- `apps/server/`：本地服务端（REST + SSE/WS），Orchestrator、Workers、Connectors、Storage、AI Gateway
- `apps/web/`：NextJS 前端（App Router），Run 列表/详情/审查/设置
- `packages/shared/`：共享 types、zod schema、事件协议、错误码、配置 schema
- `project/`：架构与对接文档（包含你已提供的 `project/wayfair-api/`*）

## 关键域模型（以 shared schema 固化）

- `Run`：一次端到端处理（amazonUrl + marketContext + 目标 class/分类结果 + 成本汇总）
- `Job`：可重试单元（step + inputHash + attempts + state + errorSummary + artifactRefs）
- `Artifact`：产物引用（type + path + contentHash + schemaVersion + createdAt）
- `Event`：对前端推送的运行事件（RUN_STARTED/JOB_PROGRESS/JOB_FAILED/NEEDS_REVIEW/RUN_COMPLETED…）

## 存储与可恢复性（文件系统 + SQLite）

- 文件系统：`data/runs/<runId>/...` 按 `architecture.md` 的建议落地（run.json、jobs/*.json、artifacts/**、logs/*.jsonl）
- SQLite（索引）：
  - `runs`：runId、状态、创建时间、当前 step、成本汇总
  - `jobs`：jobId、runId、step、状态、输入哈希、重试次数、最后错误
  - `artifacts`：artifactId、runId、jobId、type、path、hash、schemaVersion
  - `costs`：runId、jobId、provider、model、tokens、usd、latencyMs
- 幂等：每个 Job 以 `(runId, step, inputHash, version)` 作为幂等键；存在匹配 artifact 即跳过。

## API 设计（Node 服务端）

- REST：
  - `POST /api/runs`：创建 Run（amazonUrl、marketContext、可选策略配置）
  - `GET /api/runs`、`GET /api/runs/:runId`
  - `POST /api/runs/:runId/actions`：pause/resume/cancel/retryStep
  - `GET /api/runs/:runId/artifacts`：列举产物；`GET /api/runs/:runId/artifacts/`*：下载/预览
  - `POST /api/runs/:runId/review`：提交人审结果（Wayfair questions 的 answers、图片选择等）
  - `POST /api/settings/wayfair/validate`：校验 sandbox/prod 凭据并拿 token
- 事件流：`GET /api/runs/:runId/events`（SSE 优先；WS 可选扩展）
- 错误约定：统一错误码（`code`）、可重试标记（`retryable`）、建议（`suggestion`）。

## Orchestrator（工作流编排）

- 状态机步骤（建议初版）：
  - `SCRAPE_AMAZON`：通过 HasData 获取商品快照（默认只处理输入 ASIN；变体枚举与 fan-out 可配置，默认关闭；按 ASIN 幂等缓存）→ `artifacts/amazon/products/<asin>/`** + 原图下载缓存
  - `DIMENSION_ENRICH`：检查尺寸是否齐全；不齐全则走 Supplier Connector（可插拔）补全 → `artifacts/dimensions.json`
  - `WAYFAIR_CLASSIFY`：OpenAI Embedding + 本地向量库检索候选 class（或 taxonomyCategories）+ 高智模型决策 → `artifacts/wayfair/classification.json`
  - `IMAGE_CLASSIFY`：多模态/图片识别将原图归类 primary/dimension/... → `artifacts/images/classification.json`
  - `IMAGE_PLAN`：策略配置驱动生成 generation plan → `artifacts/images/plan.json`
  - `IMAGE_GENERATE`：按 plan 批次生成（primary/dimension 默认 4 候选）→ `artifacts/images/generated/`**
  - `WAYFAIR_DISCOVERY`：Catalog/Product Addition discovery：`taxonomyCategories`/`productAddition.questions`/`brandAssociations`/`mediaMetaDataTags`
  - `WAYFAIR_SUBMIT`：组装 `SubmitProductAdditionsRequest`（parts + answers + media）调用 `productAddition.submit`
  - `WAYFAIR_POLL`：轮询 `productAddition.submissions` 直至 SUCCEEDED/FAILED，失败则进入人审修正
  - `NEEDS_REVIEW`：前端展示 questions（含 possibleAnswers/childQuestions/importanceType）+ validationFlaws，用户补齐/改正后回提
  - `WAYFAIR_CATALOG_READ_VERIFY`：可选，用 `supplierCatalog` 验证是否可读到新 part
- 取消/暂停：Run 级信号传播到 worker；在安全点落盘并发出事件。

## Pools / Batches（并发与成本）

- AmazonDataApiPool：限制并发与速率；统一重试/熔断/预算；对 `429/5xx` 做指数退避，保证成本与稳定性可控。
- WayfairApiPool：GraphQL QPS 限制（按文档 10 rps discovery；submit 1/s）+ `Retry-After`/指数退避。
- ModelPool：LLM/embedding 并发与预算控制；记录 cost。
- ImagePool：图片生成并发与批次（primary/dimension 4 候选一批）。

## Connectors（可插拔）

- `AmazonConnector`：对接 HasData，把返回规范化为稳定 schema，并对缺失字段/失败输出 NEEDS_REVIEW（让用户修正链接或选择站点）。
- `WayfairConnector`：
  - token：`POST https://sso.auth.wayfair.com/oauth/token`（client_credentials + audience）
  - GraphQL endpoints：
    - Supplier Catalog：`https://api.wayfair.io/{sandbox/}v1/supplier-catalog-api/graphql`（scope `read:catalog_products`）
    - Product Catalog（Product Addition）：`https://api.wayfair.io/{sandbox/}v1/product-catalog-api/graphql`（按文档 scopes）
  - 封装 queries：`taxonomyCategories`、`productAddition.questions`、`supplierBrand.brandAssociations`、`media.mediaMetaDataTags`、`productAddition.submit`、`productAddition.submissions`
- `SupplierConnector`：尺寸补全（暂未知，先接口 + mock 实现）。
- `ImageProvider`：图片识别/重绘（先接口 + mock；后续可接任意供应商）。

## AI Gateway（输出规范化）

- 统一 `AgentResult<T>`：`data/confidence/evidence/model/cost/errors`，用 zod 校验。
- 解析失败：先 repair（强制 schema）后重试；达到上限进入 NEEDS_REVIEW。
- Embedding：OpenAI embedding（模型与维度在配置中可切换），向量索引本地持久化。

## NextJS 前端（本地 UI）

- 页面：
  - Run 列表/新建（输入 amazonUrl、选择 sandbox/prod、marketContext、策略）
  - Run 详情：进度时间线、Job 列表、实时日志、artifact 浏览/预览（JSON/图片）
  - 审查页：
    - Wayfair `questions` 渲染成表单组件（STRING/DECIMAL/INTEGER/BOOLEAN/SINGLE_CHOICE/MULTI_CHOICE）
    - 支持 childQuestions/conditional（importanceType）展示
    - 展示 `validationFlaws` 定位到具体 questionId
    - 图片候选选择（primary/dimension）
  - 设置页：输入 sandbox/prod 的 clientId/clientSecret/audience(自动)/supplierId/默认 marketContext；一键“验证并获取 token”
- UI 仅做渲染与提交，不包含业务逻辑；所有状态从事件流 + REST 获取。

## 安全与合规

- 凭据：不入库；本地安全存储（优先 keytar/系统凭据管理；失败降级为加密文件）。
- 日志脱敏：token/secret/cookie 不落盘明文。
- 合规：图片/文案输出强制 evidence；低置信度/风险词进入人审。

## 可观测性

- 结构化日志 JSONL：`timestamp/level/runId/jobId/step/message/err`；终端集中输出 + 落盘。
- 指标：每 step 耗时、失败率、Wayfair 429/403、模型 cost。

## 需要同步更新的架构文档

- `project/architecture.md` 已改为 Product Addition 的 discovery→submit→poll→review→resubmit（不再依赖 xlsx 模板）。

## Wayfair API（GraphQL）对接规范（用于其它 agent 直接落地）

> 目标：让“对接 Wayfair”这件事**不需要猜字段**。所有模块统一依赖这里的类型与 schema。

### 认证（OAuth token）

- **token endpoint**：`POST https://sso.auth.wayfair.com/oauth/token`
- **grant_type**：`client_credentials`
- **audience**：
  - sandbox：`https://sandbox.api.wayfair.com/`
  - prod：`https://api.wayfair.com/`
- **token 有效期**：24h（建议 12h 主动刷新）
- **调用 header**：`Authorization: Bearer <access_token>`

### GraphQL endpoints

- **Supplier Catalog（read）**：`https://api.wayfair.io/{sandbox/}v1/supplier-catalog-api/graphql`（scope `read:catalog_products`）
- **Product Catalog / Product Addition（write）**：`https://api.wayfair.io/{sandbox/}v1/product-catalog-api/graphql`（scopes 以文档为准；至少包含 questions、submit、submissions、brands、taxonomy、media tags）

### TypeScript types（建议位置：`packages/shared/src/wayfair/types.ts`）

```ts
export type WayfairEnv = "sandbox" | "prod";

export type WayfairBrandInput =
  | "WAYFAIR"
  | "JOSS_AND_MAIN"
  | "PERIGOLD"
  | "ALLMODERN"
  | "BIRCHLANE";

export type WayfairCountryInput =
  | "UNITED_STATES"
  | "UNITED_KINGDOM"
  | "GERMANY"
  | "CANADA";

export type WayfairMarketContextInput = {
  // Example: "en-US"
  locale: string;
  country: WayfairCountryInput;
  brand: WayfairBrandInput;
};

export type WayfairQuestionAnswerType =
  | "DECIMAL"
  | "BOOLEAN"
  | "SINGLE_CHOICE"
  | "INTEGER"
  | "MULTI_CHOICE"
  | "STRING"
  | "ENUM";

export type WayfairQuestionImportanceType =
  | "OPTIONAL"
  | "REQUIRED"
  | "CONDITIONAL"
  | "RECOMMENDED";

export type WayfairPossibleAnswer = {
  key?: string | null;
  // IMPORTANT: This is the value Wayfair expects back in submit answers.
  value: string;
};

export type WayfairProductAdditionQuestion = {
  id: string;
  displayName: string;
  answerType: WayfairQuestionAnswerType | null;
  isActive: boolean;
  isMultiValue: boolean;
  importanceType?: WayfairQuestionImportanceType | null;
  possibleAnswers: WayfairPossibleAnswer[];
  childQuestions: WayfairProductAdditionQuestion[];
  isUnavailableEligible?: boolean | null;
  isNotApplicableEligible?: boolean | null;
};

export type WayfairSupplierBrandAssociation = {
  id: string;
  manufacturer: { id: string; name?: string | null };
};

export type WayfairBrandAssociationsPageInfo = {
  hasNextPage: boolean;
  totalPages: number;
};

export type WayfairBrandAssociationsResponse = {
  brands: WayfairSupplierBrandAssociation[];
  pageInfo: WayfairBrandAssociationsPageInfo;
};

export type WayfairMediaMetaDataTagTypeInput =
  | "DOCUMENT"
  | "LEGAL_DOCUMENT"
  | "LANGUAGE"
  | "REGION";

export type WayfairMediaMetaDataTag = {
  metaDataId: string;
  name: string;
};

export type WayfairMediaMetaDataTagSet = {
  metaDataTagType: WayfairMediaMetaDataTagTypeInput;
  metaDataTags: WayfairMediaMetaDataTag[];
};

export type WayfairMediaDocumentTypeInput = "DOCUMENT" | "LEGAL_DOCUMENT";

export type WayfairMediaDocumentInput = {
  mediaDocumentType: WayfairMediaDocumentTypeInput;
  documentUrl: string;
  documentTypes: string[];
  regionType: string;
  language: string;
};

export type WayfairMediaInput = {
  images?: string[] | null;
  videos?: string[] | null;
  documents?: WayfairMediaDocumentInput[] | null;
};

export type WayfairAnswer = {
  questionId: string;
  // Serialized as string per API doc; must be convertible to the target type.
  value: string;
  // For multi-value / multi-choice. If omitted, default behavior should be 1.
  parentRank?: number;
  rank?: number;
};

export type WayfairProductPartWithAnswers = {
  supplierPartNumber: string;
  answers: WayfairAnswer[];

  // Optional shortcuts (can be provided instead of answering some "core::..." questions).
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  amazonStandardIdentificationNumber?: string | null;
  collectionName?: string | null;
  manufacturerPartNumber?: string | null;
  manufacturerProductUrl?: string | null;
  productName?: string | null;
  universalProductCode?: string | null;
  featureBullets?: string[] | null;
  marketingCopy?: string | null;
  media?: WayfairMediaInput | null;

  // Per-part override
  ignoreWarnings?: boolean | null;
};

export type WayfairSubmitProductAdditionRequest = {
  classId: number;
  marketContext: WayfairMarketContextInput;
  parts: WayfairProductPartWithAnswers[];
};

export type WayfairSubmitProductAdditionsRequest = {
  supplierId: string;
  proposedProductAdditions: WayfairSubmitProductAdditionRequest[];
  ignoreWarnings?: boolean | null;
  rejectAllOnErrors?: boolean | null;
};

export type WayfairSubmitProductAdditionsResponse = {
  requestIds: string[];
};

export type WayfairOperationStatus = "SUCCEEDED" | "FAILED";

export type WayfairValidationFlawType = "ERROR" | "WARNING";

export type WayfairValidationFlaw = {
  questionId: string;
  flawType: WayfairValidationFlawType;
  flaw: string;
  // Present on submissions response; useful for mapping to repeating answers.
  parentRank?: number | null;
  rank?: number | null;
};

export type WayfairProductAdditionStatus =
  | "VALIDATING"
  | "VALIDATED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "PROCESSING"
  | "LIVE";

export type WayfairProductAdditionSubmission = {
  requestId: string;
  supplierId: string;
  supplierPartNumber?: string | null;
  classId: number;
  marketContext: { locale: string; country: string; brand: string };
  status: WayfairProductAdditionStatus;
  validationStatus?: WayfairOperationStatus | null;
  submissionStatus?: WayfairOperationStatus | null;
  validationFlaws: WayfairValidationFlaw[];
};
```

### Discovery → Submit → Poll：产物与幂等键（建议位置：`packages/shared/src/wayfair/artifacts.ts`）

- **Discovery artifacts**
  - `artifacts/wayfair/taxonomyCategories.json`（按 `marketContext`）
  - `artifacts/wayfair/questions.json`（按 `supplierId + classId + marketContext`）
  - `artifacts/wayfair/brandAssociations.json`（按 `supplierId + marketContext`）
  - `artifacts/wayfair/mediaMetaDataTags.json`（按 `marketContext + metaDataTagTypes`）
- **Submit artifacts**
  - `artifacts/wayfair/submit/request.json`：`WayfairSubmitProductAdditionsRequest`
  - `artifacts/wayfair/submit/requestIds.json`：`string[]`
  - `artifacts/wayfair/submissions/<requestId>.json`：`WayfairProductAdditionSubmission[]`（每次 poll 追加快照或覆盖）

幂等建议：

- `WAYFAIR_DISCOVERY`：key = `env + supplierId + marketContext + classId + schemaVersion`
- `WAYFAIR_SUBMIT`：key = `env + supplierId + sha256(request.json) + schemaVersion`
- `WAYFAIR_POLL`：key = `env + supplierId + requestIds.join(",")`

### 自动回答（AnswerBuilder）策略（用于“完全自动化”）

目标是把 questions 变成 answers，并尽量让第一次 submit 就通过；失败时再基于 validationFlaws 自动修复。

- **步骤 A：生成“question index”**
  - 将 `WayfairProductAdditionQuestion[]` 展平成 `Map<questionId, question>`
  - 记录每个 question 的 `answerType/isMultiValue/possibleAnswers/importanceType/childQuestions`
- **步骤 B：确定 `manufacturerId`**
  - 从 `brandAssociations` 选一个默认 manufacturer（策略可配置：按 name 匹配/默认第一个/固定 manufacturerId）
  - 写入 `parts[].manufacturerId`（避免重复回答 core::manufacturerId）
- **步骤 C：媒体（images）**
  - `parts[].media.images` 至少 1 张（优先使用已生成/已挑选的 primary image URL；否则退回原图）
- **步骤 D：answers 生成**
  - 对每个 questionId 走 mapping：
    - **规则映射（优先）**：例如价格/尺寸/颜色/材质/包装等，从 Amazon/specs/dimensions 中提取并规范化
    - **choice 映射**：把候选值标准化（大小写/同义词）后与 `possibleAnswers[].value` 做匹配；仅允许输出命中的 value
    - **数值映射**：DECIMAL/INTEGER 输出可解析字符串（例如 "12.5"）
    - **BOOLEAN 映射**：统一输出 "Yes"/"No" 或按 possibleAnswers 指定（如果 possibleAnswers 存在则必须用其 value）
    - **multiValue/multiChoice**：生成多条 `WayfairAnswer`，用 `parentRank/rank` 从 1 递增
  - childQuestions：默认只在 parent 相关条件满足时回答；若无法判断则先不答，交由 validationFlaws 反馈驱动修复

### 自动修复（FlawReducer）策略（将 validationFlaws 收敛到 0）

- 输入：上一次 `request.json` + 最新 `submissions` + `question index`
- 输出：新的 `request.json`（只改动必要字段）并重新 submit

优先自动处理的 flaw 类型（按通用性）：

- **类型不匹配**：将 value 重新序列化（整数/小数/布尔）
- **choice 不合法**：重新匹配到 `possibleAnswers[].value`（无法匹配则标记 NEEDS_REVIEW）
- **缺少必填**：从可推导信息补齐；补不齐则 NEEDS_REVIEW
- **multiValue rank 问题**：重建该 questionId 的 answers 列表，确保 `parentRank/rank` 连续从 1 开始

### 文档缺口（需要你补充到 `project/wayfair-api/`，否则实现会走“猜测”）

目前文档中出现了 `TaxonomyAttributesByFilter` 与 `conditionalityRules` 的类型，但未给出对应 query 的**完整 GraphQL 示例**与 variables 结构。为了把“自动回答/自动修复”做得更稳，建议补充：

- `TaxonomyAttributesByFilter` 的 query 名称、入参（是否为 `AttributesFilterInput`）、返回字段示例
- conditionality rules 的获取方式（是否随 attributesByFilter 返回即可，或需要独立 query）
- Product Addition 的 `questions` 是否会返回 `description/isCustomEligible`（在示例里未取字段，但 types 中存在）
- `validationFlaws.flawType` 的完整枚举与常见 flaw 文案（用于自动分类与修复策略）

## 交付里程碑（建议）

- M1：本地服务端 + Next 前端骨架、Run/Job/Artifact/事件流跑通（全 mock）
- M2：接入 HasData 采集（含变体 fan-out 与按 ASIN 缓存）与失败降级/人审
- M3：接入 Wayfair token + discovery + submit + poll（sandbox）
- M4：图片分类/重绘与策略化（provider 可插拔）
- M5：断点续跑、取消/暂停、成本/限流、审计与完善 UI

