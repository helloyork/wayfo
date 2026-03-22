import type { WayfairMarketContextInput } from "@wayfo/shared";
import type { WayfairEnv } from "../../connectors/wayfair";
import { fetchWayfairQuestions } from "../wayfair/discovery";
import { flattenQuestions } from "../wayfair/answerRules";

export type PlanTemplateQuestionColumn = {
  fieldId: string;
  displayName: string;
  width: number;
};

type Credentials = {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
};

/**
 * Fetch productAddition.questions for each classId and merge columns by question id
 * (first non-empty displayName wins; stable sort by fieldId).
 */
export async function buildMergedQuestionColumnsForClasses(input: {
  classIds: number[];
  supplierId: string;
  marketContext: WayfairMarketContextInput;
  credentials: Credentials;
}): Promise<PlanTemplateQuestionColumn[]> {
  const seenIds = new Set<string>();
  const columns: PlanTemplateQuestionColumn[] = [];

  for (const classId of input.classIds) {
    const questions = await fetchWayfairQuestions({
      credentials: input.credentials,
      supplierId: input.supplierId,
      classId,
      marketContext: input.marketContext
    });
    const flat = flattenQuestions(questions);
    for (const q of flat) {
      if (!q.id || seenIds.has(q.id)) {
        continue;
      }
      seenIds.add(q.id);
      const displayName = (q.displayName ?? "").trim();
      columns.push({
        fieldId: q.id,
        displayName,
        width: 28
      });
    }
  }

  columns.sort((a, b) => a.fieldId.localeCompare(b.fieldId));
  return columns;
}
