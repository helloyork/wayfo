---
name: json-to-ts-types
description: 从单个或多个 JSON 样例推断 TypeScript 类型/接口并输出。适用于用户提供 JSON、样例数据、或要求推断 TS 类型/接口的场景。
---

# JSON to TypeScript Types

## Quick Start

1. 读取所有 JSON 样例，识别顶层结构（object/array/primitive）。
2. 归并多样例差异，输出统一的 TypeScript 类型或接口。
3. 仅返回 TypeScript 定义本身，不附加说明，除非用户要求。

## Workflow

1. **Normalize**: 将所有样例解析为对象/数组/原始值，记录每个字段的类型集合。
2. **Merge**: 多样例字段合并为联合类型；缺失字段标记为可选。
3. **Name**: 顶层类型使用 PascalCase；嵌套对象按语义命名，无法推断时用 `...Item` / `...Entry`。
4. **Emit**: 输出 `type` 或 `interface`（由调用方代理决定），优先使用单一导出。

## Type Inference Rules

- **Primitive**: string/number/boolean/null 按值推断；`null` 与非 null 合并为联合。
- **Array**: 统一元素类型；多种元素类型输出联合数组（`Array<A | B>`）。
- **Object**: 字段缺失 → 可选；字段类型不一致 → 联合类型。
- **Dates**: 仅在字符串满足明确日期格式且用户同意时转为 `Date`，否则保持 `string`。

## Output Rules

- 只输出 TypeScript 类型定义，不写解释性文本。
- 对多层嵌套对象优先抽取为命名类型，避免匿名深层嵌套。
- 保持字段顺序稳定：优先按样例出现顺序，其次按字母序。

## Edge Cases

- 只有单一样例时，尽量保守；不主动扩展类型范围。
- 样例不一致时，优先联合类型而非 `any`。
- 无法推断的字段使用 `unknown`，避免 `any`。
