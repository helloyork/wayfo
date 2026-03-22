import type { WayfairAnswer, WayfairProductAdditionQuestion } from "@wayfo/shared";
import { normalizeAnswerValue } from "./answerRules";

/**
 * Convert plan Excel values (per questionId) into WayfairAnswer rows using question metadata.
 */
export function planEntriesToWayfairAnswers(
  questionMap: Map<string, WayfairProductAdditionQuestion>,
  entries: Array<{ questionId: string; values: string[] }>
): WayfairAnswer[] {
  const out: WayfairAnswer[] = [];
  for (const entry of entries) {
    const q = questionMap.get(entry.questionId);
    if (!q || !q.isActive) {
      continue;
    }
    const normalizedValues = entry.values
      .map((v) => normalizeAnswerValue(String(v ?? ""), q))
      .filter((v): v is string => Boolean(v));
    if (normalizedValues.length === 0) {
      continue;
    }
    if (!q.isMultiValue && q.answerType !== "MULTI_CHOICE") {
      out.push({ questionId: entry.questionId, value: normalizedValues[0] });
      continue;
    }
    normalizedValues.forEach((value, index) => {
      const row: WayfairAnswer = {
        questionId: entry.questionId,
        value,
        parentRank: index + 1
      };
      if (q.answerType === "MULTI_CHOICE") {
        row.rank = index + 1;
      }
      out.push(row);
    });
  }
  return out;
}

/** Plan answers override generated answers for the same questionId. */
export function mergeGeneratedAnswersWithPlan(
  generated: WayfairAnswer[],
  planAnswers: WayfairAnswer[]
): WayfairAnswer[] {
  const planIds = new Set(planAnswers.map((a) => a.questionId));
  const filtered = generated.filter((a) => !planIds.has(a.questionId));
  return [...filtered, ...planAnswers];
}
