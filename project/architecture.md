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
  - 定义状态机（采集→分析→生成→模板→审查→导出/上传）。
  - 负责断点续跑、幂等、重试、取消、暂停/恢复、Run 汇总。
- **任务执行层（Workers）**
  - Scrape / Enrich(Dimension) / Classify / Image / Template / Export / Upload 等具体 worker。
  - 输入与输出都使用统一 schema（见“Agent 输出规范化”）。
- **连接器层（Connectors）**
  - **Amazon Connector**：基于 HasData Amazon Product 数据接口获取结构化商品信息与资源链接，并将结果规范化为稳定 schema 与可缓存 artifact。
  - **Wayfair Connector**：模板下载、上架 API 调用、错误解析与重试建议。
  - **Supplier Connector**：尺寸等补全数据源 API。
- **AI 适配层（AI Gateway）**
  - 统一模型调用（LLM/Embedding/Image/Multi-modal），做：重试、超时、配额、成本记录、输出校验与降级。
  - Prompt 与输出 schema 版本化，保证可复现。
- **存储层（Storage）**
  - 文件系统作为 artifact store（JSON/图片/xlsx/log）。
  - 轻量索引（建议 SQLite）记录 Run/Job 状态、产物路径、成本、审计信息。
- **可观测性层（Observability）**
  - 结构化日志、Run/Job 关联 ID、关键指标（耗时/失败率/模型成本/外部 API 429）。
- **安全与合规层（Security & Compliance）**
  - 密钥管理、日志脱敏、内容合规检查与审计记录。

---

## 数据、缓存与状态模型（建议落地）

### 核心概念
- **Run**：用户发起的一次端到端处理（一个 Amazon 链接或一个产品集合）。
- **Job**：Run 中的一个可重试单元（例如“采集页面”“生成图片批次”“填充模板”）。
- **Artifact**：Job 的输出产物（JSON、图片、xlsx、向量索引等）。

### 建议的本地目录布局（可调）
- `data/runs/<runId>/run.json`：Run 元信息、当前状态、时间戳、版本、成本汇总
- `data/runs/<runId>/jobs/<jobId>.json`：Job 状态、重试次数、错误摘要、输入输出引用
- `data/runs/<runId>/artifacts/amazon/products/<asin>/provider/raw.json`：HasData 原始返回（便于回放与排错）
- `data/runs/<runId>/artifacts/amazon/products/<asin>/product.json`：规范化后的商品快照（稳定 schema）
- `data/runs/<runId>/artifacts/amazon/products/<asin>/images/index.json`
- `data/runs/<runId>/artifacts/amazon/products/<asin>/images/original/*`
- `data/runs/<runId>/artifacts/images/classification.json`
- `data/runs/<runId>/artifacts/images/generated/<type>/*`
- `data/runs/<runId>/artifacts/wayfair/template.xlsx`
- `data/runs/<runId>/artifacts/wayfair/filled.json`
- `data/runs/<runId>/artifacts/wayfair/final.xlsx`
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
- 变体（variants）可按批次并行：每个变体的字段填充/图片组合/模板行生成作为批次任务。

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
- `variants`（变体维度 + 每个变体的 `asin`/链接）
- `productInformation/specs`（键值对）
- `images`（尽可能包含高清图）

### 变体（Variants）任务模型（必须）

系统需要把“一个 Amazon 链接”扩展为“一组产品任务（父 ASIN + 全部变体 ASIN）”，并将**每个变体视为独立新任务加入队列**：

- `SCRAPE_AMAZON_SEED`：对用户输入链接/ASIN 抓取一次，得到父 `asin` 与 `variants[].asin` 列表
- `SCRAPE_AMAZON_ASIN`（队列任务）：对每个 `asin`（父 + 变体去重后）分别入队执行采集与落盘
  - 幂等 key 必须包含：`domain + asin + schemaVersion`（从而严格按产品 ID 缓存）
  - 任务执行前必须先走“缓存规则”，命中缓存则直接完成
- 下游步骤（Dimension/Classification/图片流水线/Wayfair）应以 `asin` 为粒度执行，使每个变体都能独立产出、独立审查、独立重试与断点续跑。

### 失败处理与人审介入（必须）

- **可自动重试**：网络抖动、`429`、`5xx`、异步 job 超时（指数退避 + 抖动；并发池限流；必要时熔断）
- **需要人审/用户操作**：`401`（key 无效）、`404`（下架/区域不支持）、或关键信息缺失（如 `asin/title/images` 缺失）

### Dimension

然后，程序会使用一个Agent分析产品详细信息，确定产品的尺寸规格是否存在**并且齐全**。如果不存在，该Agent应该返回提取出的ASIN信息。  
使用该ASIN信息，程序从ASIN查询供应商API中获取实际的尺寸规格。

### Classification

随后，程序会使用另一个Agent对产品的“class”进行分类，用于归类到特定Wayfair产品类别下。  
具体实现：
1. 初始化时爬取所有Wayfair产品Class以及具体描述（约100条），使用供应商的嵌入API创建向量并且本地储存。
2. 当需要进行分类时，使用产品的描述等信息对向量进行搜索，使用Langchain.js实现，找出排名前列特定数量的class
3. 使用高智慧模型，提供产品基础信息（标题和描述）以及前述的class列表，进行综合判断，输出最终的class和一个1~10的置信度分数（并输出证据与候选列表，便于人审）

所有信息都会本地缓存，用于后续的分析和决策。

## 2. 图片生成

图片生成的主要目标是：**对采集到的所有图片进行创意重绘（repaint）**，同时用“类型策略 + 批次策略”控制成本与并发。

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

### 2.3 图片重绘（Generate）
随后，使用图片生成 API，对计划中的图片按对应提示词进行重绘（需要输入原图）。

成本受限时的默认策略：
- **所有图片都重绘**，但大部分类型默认只生成 **1 张**候选图。
- 只有**产品主图**与**规格图**默认启用“4 图 1 批次”的多候选生成，供审查阶段让用户选择。

默认选择逻辑建议：
- 产品主图：从候选中自动选一个“默认主图”，但保留所有候选给人审切换。
- 规格图：同上。
- 其他类型：默认单图直出；如后续需要也可把某类型改成批次多候选。

### 2.4 高度可扩展的策略化设计（关键）
为了让未来“新增图片类型 / 调整哪些类型走批次 / 改候选数量”只改配置，不改业务流程：
- 图片类型作为 registry（枚举 + 显示名 + 默认提示词模板 key）。
- 生成策略由配置驱动（每种类型一份 policy）。
- Orchestrator 只执行 plan，不硬编码“哪些类型 4 图一批”。

配置示例（概念表达，可按实际实现落地为 JSON/YAML/TS config）：

```json
{
  "imageGeneration": {
    "types": {
      "primary":        { "enabled": true, "candidates": 4, "batch": true },
      "dimension":      { "enabled": true, "candidates": 4, "batch": true },
      "selling_point":  { "enabled": true, "candidates": 1, "batch": false },
      "lifestyle":      { "enabled": true, "candidates": 1, "batch": false }
    }
  }
}
```

## 3. Wayfair Template

随后，根据数据采集阶段获得的 Class 信息，使用 Wayfair API 或暴露的接口，下载对应的模板 xlsx 文件。

使用NodeJS库进行解析。每种Template文件在大体结构上相同，但是字段不同。提取出所有的字段名称。  
Template表格中的字段值可能是下拉框（单选），需要将所有选项提供给模型。

使用高智慧模型，提供产品完整信息，对所有字段进行填充，输出JSON文件。当存在无法填写的字段时，需要输出对应的字段名，用于在审查阶段要求填写字段值。

## 4. 审查

随后，使用Wayfo前端，提供用户审查。用户可以查看所有生成的信息，包括产品基本信息、变体、详细参数、介绍、所有产品图片和价格等等。  
而如果存在无法填写的字段，提供界面给用户填写。

信息完备后，合成最终的Wayfair上传文件（xlsx）。

使用Wayfair API对生产应用发起创建产品的请求。失败后，提供错误信息，并允许用户重新填写。

---

## 错误处理与可靠性

所有错误和异常都应该被妥善处理，并提供清晰的错误信息和建议。

Wayfo前端可以直接打开各个步骤储存的缓存地址，用于调试和排查问题。

Agent的输出应该规范化，并且在解析失败后进行一定次数的重试。

### 错误分级
- **可重试**：网络抖动、429/503、临时超时、模型输出不满足 schema（可 repair）。
- **不可重试**：认证失败/权限不足、模板字段变更导致不兼容（需要更新模板解析）、合规拦截（需要人工处理）。

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

## 可观测性与调试（建议补充）

- **集中日志**：所有层统一输出到终端，并同时落盘到 `data/runs/<runId>/logs/`，避免“只有前端有日志/只有 worker 有日志”。
- **结构化日志**：建议 JSONL，最少包含：`timestamp`、`level`、`runId`、`jobId`、`step`、`message`、`err`（可选）。
- **关联 ID**：任何外部 API/模型调用都记录 requestId（如提供方返回），并与 `runId/jobId` 关联，便于定位失败与费用。
- **事件流**：Orchestrator 对外推送 Run 事件（如 `RUN_STARTED`/`JOB_PROGRESS`/`JOB_FAILED`/`NEEDS_REVIEW`/`RUN_COMPLETED`），前端只订阅事件并渲染状态，避免 UI 与业务逻辑耦合。
