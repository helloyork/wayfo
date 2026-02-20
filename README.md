# Wayfo

Wayfor通过自动化工具无缝连接Amazon和Wayfair两大电商平台，帮助用户高效迁移和优化家居产品数据，实现从数据采集到上架的全链路自动化.

同时，Wayfo 注重图片创意再生和人工审核，确保产品质量和合规性。目的是简化电商运营流程，让小型商家或开发者能够轻松扩展业务，创造更多家居领域的创新机会。

## 关键工程

参阅[Architecture](./project/architecture.md)

## 实现

Wayfo 采用了一条自动化黑盒工作流，只有在遇到异常和最终审查阶段才会要求人工介入。

### 初始化

Wayfo 在启动时，会进行：
- 环境校验：检查 Wayfair/OpenAI/HasData 凭据是否配置正确，检查`supplierId` 与 `marketContext` 有效
- 初始化身份验证：使用提供地 Wayfair 验证信息对 Wayfair API 进行身份验证，获取 token
- Taxonomy 初始化（全局缓存，生命周期 1 个月）：通过 Wayfair taxonomy API 分池拉取所有 class 及其可用于检索的描述信息，构建 BM25 索引，用于关键词召回

### 启动

用户在 Wayfo 前端创建一个 Run时，需要提供亚马逊产品链接和市场上下文（例如US/EU/JP）。

### 1.  数据采集

Wayfo会默认维护本地目录缓存，并通过 **HasData** 拉取商品结构化数据。该方案的目标是：稳定、可维护、可观测，同时避免在本地维护浏览器自动化与反爬对抗。

系统默认只处理“一个 Amazon 链接/ASIN”，不会自动穷举变体。变体枚举可配置开启，开启后才会把“一个 Amazon 链接”扩展为“一组产品任务（父 ASIN + 全部变体 ASIN）”，并将每个变体视为独立新任务加入队列：

然后，程序会使用一个Agent分析产品详细信息，确定产品的尺寸规格是否存在并且齐全。如果不存在，该Agent应该返回提取出的ASIN信息。  
使用该ASIN信息，程序从ASIN查询供应商API中获取实际的尺寸规格。

### 2. 分类

在拉取到产品信息后，对商品信息抽取关键词，供后续分类与检索复用。

随后，程序会使用另一个Agent对产品的“class”进行分类，用于归类到特定Wayfair产品类别下。

1. **候选召回（BM25 + Keywords）**
   - 输入：产品关键词（从 title/specs/material/color/style 抽取）。
   - 召回：BM25 TopK（关键词召回）得到候选集合。
2. **LLM 最终判定（Agent）**
   - 给 Agent：产品信息（标题/描述/specs/尺寸）+ 候选 class 列表（classId/name/path/关键描述片段）+ 候选得分与证据。
   - 输出落盘：`artifacts/wayfair/classification.json`，并强制带 `evidence`（命中的关键词/相似片段/Top candidates），用于人审。

所有信息都会本地缓存，用于后续的分析和决策。

### 3. 图片生成
