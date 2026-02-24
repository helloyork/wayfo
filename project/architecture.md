# Wayfo Architecture

## 预期应用

Wayfo是一个本地运行的 Node.js 应用，带有一个简单的命令行参数解析，用于启动一个完整的复杂的 localhost 网页服务。

该网页服务被称为Wayfo的“前端”，用于进行一切必要交互，包括提供所需信息，监控任务进度和完成交付审查。

所有代码都必须模块化、良好编写、遵循最佳实践，实现低耦合高可扩展性，并且项目文件规划有条理。

所有代码由Agent实现时，需要分层实现，每层都可以**单独测试**，独立运行并且监控状态。输出信息和错误应该集中输出到终端。

同时还要实现池和批次的概念，用于并行高效运行任务。

---

## 关键目标与非目标

### 目标（Goals）
- **Local-first**：默认本地运行、本地存储；无需依赖自建后端即可完成从采集到上架。
- **Human-in-the-loop**：任何存在不确定性/合规风险的输出都应进入审查环节由用户确认。
- **可恢复与可追溯**：每一步都应产生可缓存的产物（artifact）与结构化日志，支持失败重试与断点续跑。
- **可扩展**：采集端（Amazon）与上架端（Wayfair）都应以 connector 形态抽象，未来可扩展到更多平台。
- **成本与限流可控**：对浏览器资源、外部 API、模型调用要有并发与预算控制。

### 非目标（Non-goals）
- **不以“绕过反爬虫/风控”为目标**：使用合规的第三方数据服务获取公开商品信息，并遵守目标站点条款与速率限制。
- **不承诺 100% 自动上架**：字段缺失、类目不确定、合规风险（图片/文案/商标）必须交由人工确认。

---

## 系统分层与模块边界（建议实现）

> 目的：让每层可单测、可独立运行、可观测，并降低耦合。

- **CLI 层（入口）**
  - 解析参数、加载配置、启动本地服务、创建 Run。
  - 只做编排入口，不包含业务逻辑。
- **Web 前端层（UI）**
  - 输入 Amazon 链接/账号信息（如需要）、展示进度、展示产物、提供人审与编辑能力。
  - 通过后端 API/WebSocket 订阅 Run 事件（进度/日志/错误/需要用户输入）。
- **本地服务端（API + 事件）**
  - 提供 REST API（读写缓存/触发流程/提交人审结果）与 WebSocket/SSE（推送进度事件）。
  - 统一鉴权（本地默认弱鉴权也应预留 token），统一错误码与响应结构。
- **工作流编排层（Orchestrator）**
  - 定义状态机（采集→分析→生成→Wayfair discovery/submit/poll→审查→重提）。
  - 负责断点续跑、幂等、重试、取消、暂停/恢复、Run 汇总。
- **任务执行层（Workers）**
  - Scrape / Enrich(Dimension) / Classify / Image / WayfairDiscovery / WayfairSubmit / WayfairPoll / Review 等具体 worker。
  - 输入与输出都使用统一 schema（见“Agent 输出规范化”）。
- **连接器层（Connectors）**
  - **Amazon Connector**：基于 HasData Amazon Product 数据接口获取结构化商品信息与资源链接，并将结果规范化为稳定 schema 与可缓存 artifact。
  - **Wayfair Connector**：Wayfair Catalog API（GraphQL）对接：OAuth token、discovery（taxonomy/questions/brands/media tags）、submit、submissions 轮询、validationFlaws 解析与自动修复/人审建议。
  - **Supplier Connector**：尺寸等补全数据源 API。
- **AI 适配层（AI Gateway）**
  - 统一模型调用（LLM/Embedding/Image/Multi-modal），做：重试、超时、配额、成本记录、输出校验与降级。
  - Prompt 与输出 schema 版本化，保证可复现。
- **存储层（Storage）**
  - 文件系统作为 artifact store（JSON/图片/log）。
  - 轻量索引（建议 SQLite）记录 Run/Job 状态、产物路径、成本、审计信息。
- **可观测性层（Observability）**
  - 结构化日志、Run/Job 关联 ID、关键指标（耗时/失败率/模型成本/外部 API 429）。
- **安全与合规层（Security & Compliance）**
  - 密钥管理、日志脱敏、内容合规检查与审计记录。

---

## 数据、缓存与状态模型（建议落地）

### 核心概念
- **Run**：用户发起的一次端到端处理（一个 Amazon 链接/ASIN；默认只处理该产品，变体可配置）。
- **Job**：Run 中的一个可重试单元（例如“采集页面”“生成图片批次”“Wayfair discovery/submit/poll”）。
- **Artifact**：Job 的输出产物（JSON、图片、BM25 索引等）。

### 建议的本地目录布局（可调）
- `data/runs/<runId>/run.json`：Run 元信息、当前状态、时间戳、版本、成本汇总
- `data/runs/<runId>/jobs/<jobId>.json`：Job 状态、重试次数、错误摘要、输入输出引用
- `data/runs/<runId>/artifacts/amazon/products/<asin>/provider/raw.json`：HasData 原始返回（便于回放与排错）
- `data/runs/<runId>/artifacts/amazon/products/<asin>/product.json`：规范化后的商品快照（稳定 schema）
- `data/runs/<runId>/artifacts/amazon/products/<asin>/images/index.json`
- `data/runs/<runId>/artifacts/amazon/products/<asin>/images/original/*`
- `data/runs/<runId>/artifacts/images/classification.json`
- `data/runs/<runId>/artifacts/images/generated/<type>/*`
- `data/cache/wayfair/taxonomy/<env>/<poolId>/<marketContextHash>/taxonomyCategories.json`：taxonomyCategories 缓存（按 env + poolId + marketContext，生命周期 1 个月）
- `data/cache/wayfair/taxonomy/<env>/<poolId>/<marketContextHash>/documents.jsonl`：用于检索的“类目文档”（包含 classId/name/path/description/specHints 等）
- `data/cache/wayfair/taxonomy/<env>/<poolId>/<marketContextHash>/bm25/*`：BM25 索引（关键词召回）
- `data/cache/wayfair/taxonomy/<env>/<poolId>/<marketContextHash>/meta.json`：初始化元数据（initializedAt/expiresAt/schemaVersion）
- `data/runs/<runId>/artifacts/wayfair/taxonomyRef.json`：本次 Run 绑定的 taxonomy cache（env/poolId/marketContextHash/meta 版本）
- `data/runs/<runId>/artifacts/wayfair/questions.json`：productAddition.questions 的问题树（按 supplierId + classId + marketContext）
- `data/runs/<runId>/artifacts/wayfair/brandAssociations.json`：supplierBrand.brandAssociations 返回（manufacturerId 候选）
- `data/runs/<runId>/artifacts/wayfair/mediaMetaDataTags.json`：media.mediaMetaDataTags 返回（documents tags）
- `data/runs/<runId>/artifacts/wayfair/submit/request.json`：最终 SubmitProductAdditionsRequest（可重放）
- `data/runs/<runId>/artifacts/wayfair/submit/requestIds.json`：submit 返回的 requestIds
- `data/runs/<runId>/artifacts/wayfair/submissions/<requestId>.json`：submissions 轮询快照（含 validationFlaws）
- `data/runs/<runId>/logs/*.log`（结构化 JSONL 或可解析文本）

### 幂等与断点续跑
- **每个 Job 都必须幂等**：相同输入与版本号下重复执行，输出路径稳定、结果可覆盖或版本化。
- **断点续跑优先读 artifact**：当产物存在且版本匹配时跳过执行，仅在缺失/过期时重跑。

---

## 池（Pool）与批次（Batch）（工程定义）

### Pool：受限资源池
- **Amazon Data API Pool**：对 HasData 的并发与速率限制（令牌桶/漏桶），并统一做重试、熔断、预算与请求审计。
- **API Client Pool**：对 Supplier/Embedding/Image/Wayfair API 的并发与速率限制（令牌桶/漏桶）。
- **Model Call Pool**：对 LLM/多模态调用做并发与预算控制，避免爆量与费用失控。

### Batch：可并行的任务分组
- 图片生成通常以“批次”并行：例如主图/规格图在一个批次内生成 4 张候选，受限于 image API 并发与成本。
- 变体（variants）支持“**批次化处理**”（仅当启用处理所有变体时）：**一个变体组作为一个批次（VariantBatch）**进入下游（图片生成、审查 UI、提交），以降低重复生成与人审成本，并保证“共享图片规则”一致执行（见下文“变体批次处理规则”）。

### 取消、暂停与恢复
- Run 级别支持取消/暂停；Orchestrator 需要把取消信号传播到 worker，并在安全点落盘。
- 恢复时从最后一个一致性 checkpoint 继续。

---

## Agent 输出规范化（必须）

为了保证可解析、可重试、可观测，所有 Agent/模型调用输出必须满足统一结构（JSON）：
- **data**：结构化结果（必须可被 schema 校验）
- **confidence**：0~1 或 1~10 的置信度（需统一量纲）
- **evidence**：引用的输入片段/图片索引/候选 class（便于人审）
- **model**：模型与版本信息（便于复现）
- **cost**：token/请求计费与耗时
- **errors**：可重试 vs 不可重试的错误分类

当解析失败时：
- **先修复输出（re-ask / repair）**：限定输出 schema 重新请求
- **再重试**：指数退避 + 抖动；达到上限后进入“需要人工介入”状态

---

Wayfo的工作流分为以下几个步骤（含建议补充）：

## 0. Run 创建前置门禁（必须）

创建 Run 时，如果未完成初始化，则需要先初始化；且前提是 Wayfair 密钥配置正确（Sandbox/Production 应用 ID、密钥和供应商 ID）。

- **Wayfair 密钥预检**：
  - 对目标环境（sandbox/prod）获取 token 成功
  - `supplierId` 与 `marketContext` 有效（能够完成最小 discovery 请求）
- **Taxonomy 初始化（全局缓存，生命周期 1 个月）**：
  - 通过 Wayfair taxonomy API 分池拉取所有 class 及其可用于检索的描述信息（至少包含 `classId/name/path`；如果 API 提供规范/描述也应一并缓存）
  - 构建 BM25 索引，用于关键词召回
  - 初始化完成后才允许进入后续步骤

实现层面的建议（可优化点）：
- 把 Run 的创建与“初始化任务”解耦：`POST /runs` 允许先创建 Run（状态 `INITIALIZING`），初始化完成后自动推进；避免前端等待超时。
- 以 `env + poolId + marketContext` 为缓存 key，并记录 `expiresAt`；过期刷新可后台执行，但刷新期间仍可使用旧索引（读写双版本）以保证可用性。

## 1. 数据采集

通过Wayfo前端，用户会向应用提供一个亚马逊产品链接。

Wayfo会默认维护本地目录缓存，并通过 **HasData** 拉取商品结构化数据。该方案的目标是：**稳定、可维护、可观测**，同时避免在本地维护浏览器自动化与反爬对抗。

### HasData（唯一数据供应商）

- **模式**：异步 job（提交→拿 `jobId`→poll 或 webhook）
- **核心接口（示例）**：
  - `POST https://api.hasdata.com/scrapers/amazon-product/jobs`（返回 `jobId`）
  - `GET https://api.hasdata.com/scrapers/jobs/:jobId`（状态：`pending`/`in_progress`/`finished`）
  - `GET https://api.hasdata.com/scrapers/jobs/:jobId/results?page=1&limit=100`（结果分页，`limit<=100`）
- **用量与并发**：按 plan 限制并发；超过返回 `429`；只对成功请求计费；可用 `GET https://api.hasdata.com/user/me/usage` 查询用量。

### 产物与缓存（按产品 ID/ASIN）

- **产品 ID**：统一使用 `asin` 作为产品 ID（缓存 key 的核心字段之一）
- **必须落盘**（每个 `asin` 一份）：
  - `artifacts/amazon/products/<asin>/provider/raw.json`：HasData 原始返回
  - `artifacts/amazon/products/<asin>/product.json`：规范化后的商品快照（稳定 schema）
  - `artifacts/amazon/products/<asin>/images/index.json` 与 `images/original/*`
- **缓存规则（必须）**：
  - 任意后续任务引用某个 `asin` 时，先检查该 `asin` 的 `product.json` 是否已存在且版本匹配；存在则**禁止再次调用 HasData**。
  - 如果 Run 内不存在但本地全局缓存（可选实现）存在，则复用全局缓存并在当前 Run 下建立引用/拷贝。

规范化后的 `product.json` 最低字段要求（缺失则进入人审/失败态）：
- `asin`、`canonicalUrl`
- `title`、`description`/`bullets`
- `price`（含 currency）、`availability`
- `variants`（可选，存在则保留变体维度 + 每个变体的 `asin`/链接）
- `productInformation/specs`（键值对）
- `images`（尽可能包含高清图）

### 变体（Variants）任务模型（可配置，默认关闭）

系统默认只处理“一个 Amazon 链接/ASIN”，不会自动穷举变体。

当开启“处理所有变体（process all variants）”时，不再把每个变体当作独立的端到端任务，而是把“主变体 + 全部变体”作为**一个批次（VariantBatch）**进入下游处理与审查：

- `SCRAPE_AMAZON_SEED`：对用户输入链接/ASIN 抓取一次，得到主 `asin` 与可选的 `variants[].asin` 列表
- `SCRAPE_AMAZON_ASIN`（采集仍可并行）：对 VariantBatch 内每个 `asin`（主 + 变体去重后）分别执行采集与落盘
  - 幂等 key 必须包含：`domain + asin + schemaVersion`（严格按产品 ID 缓存）
  - 任务执行前必须先走“缓存规则”，命中缓存则直接完成
- `VARIANT_BATCH_INDEX`（批次索引产物）：把本次批次的关键关系固化为 artifact（示例字段：`mainAsin`、`asins[]`、`variantKeys[]`、`createdAt`、`schemaVersion`），供后续图片/审查/提交统一引用

#### 变体批次处理规则（必须）

当 VariantBatch 启用时，下游的“图片生成、审查 UI、提交”必须遵循以下规则：

- **图片共享规则**：在同一批次内，除了主图 `primaryImage` 以外，其余图片均视为**批次共享**资产，且共享图片来源为**主变体重新生成的非主图图片**（所有变体共用同一组图片 URL）。
- **批量生图规则**：
  - **主变体（用户输入的那个产品）**：对**所有图片**执行重新生成（primary + 其它类型图片都生成/重绘），并产出“批次共享图片（非 primary）”集合。
  - **其余变体**：只生成/重绘 **该变体自己的主图（primaryImage）**；其它图片直接复用“主变体重新生成的批次共享图片（非 primary）”。
- **主图候选数量（Web 可编辑）**：所有产品在生成主图时，都必须由一个 Web UI 可修改字段控制候选数（例如 `primaryImageCandidateCount`）：
  - 配置为 **1**：不做“多候选抽图/选择”，直接生成 1 张主图
  - 配置为 **N（如 4）**：每个产品主图生成 N 张候选，由用户选择最终主图
  - 该字段应支持“全局默认 + Run 级覆盖”（便于临时提质/控成本）
- **审查 UI 规则**：同一批次内的所有变体必须进入**同一个预览/审查界面**：
  - 批次共享图片：只审一次，选择结果应用到全部变体
  - 变体主图：每个变体单独选择最终主图

### 失败处理与人审介入（必须）

- **可自动重试**：网络抖动、`429`、`5xx`、异步 job 超时（指数退避 + 抖动；并发池限流；必要时熔断）
- **需要人审/用户操作**：`401`（key 无效）、`404`（下架/区域不支持）、或关键信息缺失（如 `asin/title/images` 缺失）

### Dimension

然后，程序会使用一个Agent分析产品详细信息，确定产品的尺寸规格是否存在**并且齐全**。如果不存在，该Agent应该返回提取出的ASIN信息。  
使用该ASIN信息，程序从ASIN查询供应商API中获取实际的尺寸规格。

### Product Keywords（产品关键词抽取）

在拉取到产品信息（含尺寸补全）后，对商品信息抽取关键词，供后续分类与检索复用：

- **文本构造建议**：`title`、`bullets`、`description`、`productInformation/specs`（键值对）、`dimensions`、材质/颜色/风格等关键字段；对超长字段做裁剪并保留高信息密度片段。
- **产物建议**：`data/runs/<runId>/artifacts/wayfair/classification.json`（包含关键词、候选与最终判定）

### Classification

随后，程序会使用另一个Agent对产品的“class”进行分类，用于归类到特定Wayfair产品类别下。  
具体实现（初始化一次，Run 复用，并引入混合搜索）：

1. **候选召回（BM25 + Keywords）**
   - 输入：产品关键词（从 title/specs/material/color/style 抽取）。
   - 召回：BM25 TopK（关键词召回）得到候选集合。
   - **可优化点（建议）**：`rule_filter` 更适合做“硬过滤/强约束（先过滤再打分）”，避免明显不相关类目进入候选与 LLM 复核。

2. **LLM 最终判定（Agent）**
   - 给 Agent：产品信息（标题/描述/specs/尺寸）+ 候选 class 列表（classId/name/path/关键描述片段）+ 候选得分与证据。
   - 使用 prompt：

     You are a Wayfair taxonomy expert.
     Given product info and candidate classes,
     select the most accurate classId.

     Return:
     - classId
     - confidence (0-1)
     - reasoning
     - fallback_classId (if low confidence)

   - 输出落盘：`artifacts/wayfair/classification.json`，并强制带 `evidence`（命中的关键词/相似片段/Top candidates），用于人审。

所有信息都会本地缓存，用于后续的分析和决策。

## 2. 图片生成

图片生成的主要目标是：**对采集到的所有图片进行创意重绘（repaint）**，同时用“类型策略 + 批次策略”控制成本与并发。

### 2.0 变体批次下的图片资产模型（新增，必须）

当启用 VariantBatch 时，图片产物需要区分两类：

- **每变体独立（per-variant）**：`primaryImage`
- **批次共享（shared across variants）**：除 `primaryImage` 外的所有图片类型（dimension/selling_point/lifestyle/...），且共享图片必须来自**主变体的重新生成产物**

最终用于 Wayfair 的图片组合规则建议为：

- 每个变体（part）的 `media.images`：`[该变体重新生成并选定 primaryImage] + [主变体重新生成的批次共享图片（同序）]`
- 需要去重并保持稳定排序（保证幂等与可复现）

### 2.1 图片类型识别（Classification）
使用图片识别模型或多模态模型，对每张图片进行类型归类。默认支持的类型（后续可扩展）：
- 产品主图（primary）
- 规格图（dimension）
- 核心卖点图（selling_point）
- 使用场景图（lifestyle）

识别模型通过供应商 API 输入图片，输出：`type`、`confidence`、`evidence`（可选）。结果落盘缓存，便于复跑与人审。

### 2.2 重绘计划（Plan）
根据“图片类型 → 生成策略（policy）”生成一个可执行计划（generation plan）。计划至少包含：
- 本次 Run 启用哪些类型的重绘
- 每个类型要生成几张候选（单张 or 多候选）
- 是否以批次调用生成（batch）
- 生成后的自动挑选策略（例如按置信度/综合评分选默认值，或全部交给人审）

补充约束（用于满足 VariantBatch 新需求）：

- **主图候选数必须可配置**：主图候选数由 Web UI 字段 `primaryImageCandidateCount` 决定（全局默认 + Run 覆盖）。
- **批次模式下的生成范围**：
  - `mainAsin`：按策略生成所有启用类型（primary + shared types）
  - `asins[others]`：仅生成 primary（候选数同 `primaryImageCandidateCount`），shared types 全部复用 `mainAsin` 重新生成的产物引用

### 2.3 图片重绘（Generate）
随后，使用图片生成 API，对计划中的图片按对应提示词进行重绘（需要输入原图）。

成本受限时的默认策略：
- **所有图片都重绘**，但大部分类型默认只生成 **1 张**候选图。
- 只有**产品主图**默认启用“多候选生成”，候选数量由 `primaryImageCandidateCount` 控制（Web 可编辑）。
- **规格图/其它共享类型**是否多候选由策略配置决定；当启用 VariantBatch 时，默认只对 `mainAsin` 生成共享类型。

默认选择逻辑建议：
- 产品主图：从候选中自动选一个“默认主图”，但保留所有候选给人审切换。
- 规格图：同上。
- 其他类型：默认单图直出；如后续需要也可把某类型改成批次多候选。

### 2.3.1 以图生图（Image-to-Image）供应商选择（建议方案）

你当前的需求是“在线、大厂、成本可控”的以图生图。结合可用性与工程落地，建议优先级如下（都支持 image-to-image / edit 类能力）：

- **首选：OpenAI Images Edits（GPT Image）**
  - 特点：支持多图输入、`input_fidelity`（贴近原图程度）、`quality` 分档；适合“在保留商品结构的前提下做创意重绘”。
  - 工程建议：在 AI Gateway 做并发与预算硬限制，并对不同图片类型设置不同质量档位（主图/规格图高，其它类型中/低）。
- **备选：AWS Bedrock（Stability 系列）**
  - 特点：企业可用性强、权限与审计完善；适合批量与成本控制。
  - 工程建议：统一封装为 `ImageProvider`，屏蔽不同模型/版本的请求与响应差异。
- **备选：Google Vertex AI Imagen（Editing）**
  - 特点：编辑模式丰富（inpaint/outpaint/background swap），对“主图换背景/规格图局部清理”很实用。
  - 工程建议：能力开通与配额可能需要前置申请，落地时优先做成可选 provider。

无水印约束（必须考虑）：

- 部分云厂商的图像模型支持“不可见水印”开关（例如 Vertex Imagen 的 `addWatermark` 默认开启）。若要求严格“无水印”，需要在 provider 配置层显式关闭，并评估由此带来的功能约束（例如某些平台在关闭水印时会限制 `seed` 等确定性参数）。
- 避免使用默认强制水印的图像模型作为主路径（例如某些厂商自研模型可能默认加不可见水印）。

### 2.3.2 主图提示词方向（多角度展示，初版约束）

主图（primaryImage）候选的提示词应以“同一件产品、不同角度/镜头”作为主要变化维度，确保可控多样性而不改产品本体：

- 角度维度：正面、45° 斜侧、侧面、背面、俯视（top-down）、近景细节（close-up）。
- 一致性约束：保持产品材质/颜色/结构/纹理不变；保持真实比例；不添加文字、Logo、贴纸、额外配件；不生成水印/边框/拼贴。
- 场景控制：默认白/浅灰棚拍背景，软光，真实阴影；如需 lifestyle 另走独立类型策略，不要混入 primary 候选。

无论选哪家，建议都做成可插拔的 `ImageProvider`，并在配置里提供：
- 每种图片类型的提示词模板（版本化）
- `sampleCount/n`、尺寸、质量档位、是否使用 mask

### 2.4 高度可扩展的策略化设计（关键）
为了让未来“新增图片类型 / 调整哪些类型走批次 / 改候选数量”只改配置，不改业务流程：
- 图片类型作为 registry（枚举 + 显示名 + 默认提示词模板 key）。
- 生成策略由配置驱动（每种类型一份 policy）。
- Orchestrator 只执行 plan，不硬编码“哪些类型 4 图一批”。

配置示例（概念表达，可按实际实现落地为 JSON/YAML/TS config）：

```json
{
  "imageGeneration": {
    "primaryImageCandidateCount": 4,
    "types": {
      "primary":        { "enabled": true, "candidates": "use_primaryImageCandidateCount", "batch": true },
      "dimension":      { "enabled": true, "candidates": 4, "batch": true },
      "selling_point":  { "enabled": true, "candidates": 1, "batch": false },
      "lifestyle":      { "enabled": true, "candidates": 1, "batch": false }
    }
  }
}
```

### 2.5 媒体存储（上传拿到公开 URL，带生命周期）

Wayfair 产品创建请求里需要可公开访问的图片 URL，因此图片生成后必须先上传到“带生命周期”的媒体存储服务，获得 URL 后才允许进入后续提交相关步骤：

- **首选：Cloudflare R2**
  - 支持对象生命周期规则（可按 prefix 设置 N 天后自动删除），适合按 `runs/<runId>/...` 分区清理。
  - 建议把对象 key 设计为不可猜测（随机前缀/哈希），并配置 bucket 为公开只读（或通过自建边缘/代理提供公开 URL）。
- **可选替代**：AWS S3 / GCS / Azure Blob
  - 都支持成熟的 lifecycle policies；如果你最终把图片生成放到 AWS/GCP/Azure，同云存储可以降低链路复杂度与出站成本。

生命周期策略建议（保守值，避免 Wayfair 侧抓取延迟导致失效）：
- 默认保留 **90 天**；未来可在确认 Wayfair 侧抓取/入库时机后下调到 30 天。

## 3. Wayfair Catalog API（Product Addition，提交前强制审查）

模板文件（xlsx）下载/解析/填表属于**高维护成本且容错差**的方案。本项目改为使用 Wayfair 的 **Catalog API（GraphQL）** 完成 discovery→draft→review→submit→poll 的标准化上架流程：系统自动生成草稿与建议，但在真正提交前由用户确认（降低合规风险与返工成本）。

### 3.1 Discovery（拿到“本次提交所需的全部约束条件”）

> 核心原则：**所有“字段定义/可选项/必填规则”以 API 返回为准**，并落盘缓存，避免静态模板漂移。

- `taxonomyCategories(marketContext, paginationOptions)`
  - 获取 `taxonomyCategoryId + name`，用于类目选择（classId）与 UI 显示
  - taxonomy 会变动，建议至少按月刷新缓存
- `productAddition.questions(request: { supplierId, classId, marketContext })`
  - 获取 questions 树（含 `answerType/isMultiValue/possibleAnswers/childQuestions/importanceType`）
  - 前端表单与后端校验/序列化均应由该结构驱动
- `supplierBrand.brandAssociations(request: { supplierId, marketContext, page, pageSize })`
  - 获取 `manufacturer.id` 列表（`manufacturerId` 为 submit 必填）
- `media.mediaMetaDataTags(input: { metaDataTagTypes, marketContext })`
  - 当需要 documents（说明书/合规文件）时，获取合法 tags（DOCUMENT/LEGAL_DOCUMENT/LANGUAGE/REGION）

### 3.2 自动生成提交载荷（SubmitProductAdditionsRequest）

系统需要一个可重放的“提交载荷生成器”：
- 输入：Amazon 规范化商品快照 + 尺寸补全 + 图片产物 + discovery 缓存（questions/brands/tags）
- 输出：`SubmitProductAdditionsRequest`（落盘到 `artifacts/wayfair/submit/request.json`）

关键约束：
- `parts[].supplierPartNumber`：必须稳定且全局唯一（建议由 `asin + variantKey` 生成，并在设置中允许加前缀/后缀）
- `parts[].manufacturerId`：必须来自 brandAssociations
- `parts[].media.images`：至少 1 张公开可访问图片 URL（用于上线必需）
- `parts[].answers[]`：按 questions 生成；choice 类型必须从 `possibleAnswers[].value` 中选择；multi-value/multi-choice 要正确填充 `parentRank/rank`（从 1 递增）

### 3.3 submit（异步提交）

调用 `productAddition.submit(request)`，返回 `requestIds[]`：
- discovery queries 速率限制：10 rps
- submit 频率：1 次/秒
- payload 上限：15MB；建议单批最多 100 个 parts（variants 提交建议设置 `rejectAllOnErrors: true`）

### 3.4 submissions（轮询状态 + flaws 收敛）

调用 `productAddition.submissions(request: { supplierId, ids: requestIds })` 轮询直到终态：
- 状态推进：`VALIDATING` → `PROCESSING` → `SUBMITTED`
- 若存在 `validationFlaws[]`（或 `validationStatus == FAILED`）：
  - 优先尝试自动修复（类型转换、choice 纠错、补齐必填、纠正 rank、补媒体等）
  - 无法自动修复则进入 `NEEDS_REVIEW`，由 UI 精确展示 flaw 对应的 `questionId`，用户修正后重新 submit

（可选）当 submission 成功后，可通过 Supplier Catalog Read API 拉取并核验 `supplierPartNumber` 的状态变化，用于“是否可读/是否 live”检查。

## 3.5 提交前审查（Human-in-the-loop，强制步骤）
  
包括图片生成完成在内，Web 界面需要把该 Run 标记为**待审查**，用户在提交前完成以下确认：

- **图片选择（单品 / 变体批次统一规则）**：
  - 主图：每个产品主图候选数由 `primaryImageCandidateCount` 控制；用户为每个产品选择最终主图。
  - 当启用 VariantBatch 时：
    - 批次共享图片：由主变体生成（可按策略产生候选），只审一次，选择结果应用到全部变体
    - 其余变体：只需要审该变体的主图候选
- **字段确认**：展示将要发送给 Wayfair 的核心字段（classId、manufacturerId、supplierPartNumber、media.images、以及将生成的 answers），允许用户修改/确认。
- **确认发送**：只有用户确认后，才允许执行 `productAddition.submit`。

该步骤的目标是把“合规与不确定性”在真正写入 Wayfair 前拦截掉，从而减少提交失败与后续返工成本。

## 4. 审查（Human-in-the-loop，兜底闭环）

审查 UI 的主对象从“xlsx 单元格”变为“questions/answers”：
- 渲染 `productAddition.questions` 为动态表单（支持 childQuestions、multiValue、possibleAnswers）
- 展示 `validationFlaws` 并定位到具体 questionId
- 用户提交修正后，后端以相同 inputs 重新生成 submit request 并重提

---

## 错误处理与可靠性

所有错误和异常都应该被妥善处理，并提供清晰的错误信息和建议。

Wayfo前端可以直接打开各个步骤储存的缓存地址，用于调试和排查问题。

Agent的输出应该规范化，并且在解析失败后进行一定次数的重试。

### 错误分级
- **可重试**：网络抖动、429/503、临时超时、模型输出不满足 schema（可 repair）。
- **不可重试**：认证失败/权限不足、Wayfair taxonomy/questions 变更导致映射不兼容（需要更新映射策略或刷新缓存）、合规拦截（需要人工处理）。

### 重试策略
- 指数退避 + 抖动；对 429 识别 `Retry-After`；对持续失败启用熔断，避免把外部服务打挂。
- 每次重试都要记录：错误码、请求 ID（如有）、耗时、重试次数、最终决策（重试/降级/人审）。

### 断点续跑
- 任一步失败后，Run 仍应可在 UI 中“从失败步骤继续”。
- 以 artifact 与 Job 状态为准决定是否跳过或重跑。

---

## 合规与安全（建议补充）

- **密钥与账号**：API key、cookie、token 不写入仓库；优先使用环境变量或系统安全存储；日志与 UI 展示必须脱敏。
- **平台条款与速率**：Amazon/Wayfair/Supplier API 都要遵守条款与限流；对访问频率与并发做硬限制。
- **内容合规**：
  - 图片再生需避免商标/水印/侵权元素，必要时做检测并强制进入人审。
  - 文案生成需避免夸大、误导性描述与禁用词；输出应可追溯到输入证据。
- **审计**：保存人审选择、字段修改记录与最终导出文件的 hash/版本信息，便于复盘。

---

## 局域网部署与端口公开注意事项（新增）

- **前端请求目标**：当未设置 `NEXT_PUBLIC_API_BASE` 时，前端应默认使用“当前访问地址”的协议与主机（IP/域名），并固定后端端口（如 `:4000`），避免硬编码 `localhost` 导致局域网访问失败。
- **未授权访问风险**：局域网内任何人都可能直接访问 UI/API；需至少加入简易 token 或反向代理的 Basic Auth，并对敏感接口做鉴权。
- **CORS 与 CSRF**：即便同域同源，仍需限制 `Origin` 白名单与 CSRF 风险（尤其是写操作接口）。
- **端口暴露范围**：仅在可信局域网中开放端口，避免把 3000/4000 直通公网；必要时使用防火墙或路由器端口白名单。
- **密钥泄露与日志**：开放端口后日志更容易被他人访问；必须脱敏并避免在响应中返回密钥或内部路径。
- **DoS 与资源耗尽**：并发限制、速率限制与队列/池必须开启，避免局域网内的误操作导致 API/模型调用爆量。

---

## 可观测性与调试（建议补充）

- **集中日志**：所有层统一输出到终端，并同时落盘到 `data/runs/<runId>/logs/`，避免“只有前端有日志/只有 worker 有日志”。
- **结构化日志**：建议 JSONL，最少包含：`timestamp`、`level`、`runId`、`jobId`、`step`、`message`、`err`（可选）。
- **关联 ID**：任何外部 API/模型调用都记录 requestId（如提供方返回），并与 `runId/jobId` 关联，便于定位失败与费用。
- **事件流**：Orchestrator 对外推送 Run 事件（如 `RUN_STARTED`/`JOB_PROGRESS`/`JOB_FAILED`/`NEEDS_REVIEW`/`RUN_COMPLETED`），前端只订阅事件并渲染状态，避免 UI 与业务逻辑耦合。
