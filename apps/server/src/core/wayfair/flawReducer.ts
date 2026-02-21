import type {
  WayfairAnswer,
  WayfairProductAdditionQuestion,
  WayfairProductAdditionSubmission,
  WayfairSubmitProductAdditionsRequest
} from "@wayfo/shared";
import type { AmazonProductSnapshot } from "../amazon/normalize";
import {
  deriveAnswersFromSnapshot,
  flattenQuestions,
  normalizeAnswerValue,
  normalizeAnswersForPart,
  normalizeChoiceValue
} from "./answerRules";

type RepairSuggestion = {
  questionId: string;
  flawType?: string;
  flaw: string;
  repairable: boolean;
  reason: string;
  suggestedValues?: string[];
};

type ReducerResult = {
  changed: boolean;
  repairable: boolean;
  request: WayfairSubmitProductAdditionsRequest;
  summary: {
    removedAnswers: number;
    normalizedAnswers: number;
    fixedRanks: number;
    appliedFixes: number;
    unresolvedFlaws: number;
    unrepairableFlaws: number;
    touchedQuestions: string[];
  };
  suggestions: RepairSuggestion[];
};

function flattenFlaws(submissions: WayfairProductAdditionSubmission[]) {
  return submissions.flatMap((submission) =>
    (submission.validationFlaws ?? []).map((flaw) => ({
      ...flaw,
      supplierPartNumber: submission.supplierPartNumber ?? null
    }))
  );
}

function isMissingFlaw(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("required") ||
    lower.includes("is required") ||
    lower.includes("required to have an answer")
  );
}

function isChoiceFlaw(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("available choices") ||
    lower.includes("select at least one option") ||
    lower.includes("should be")
  );
}

function isRankFlaw(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("rank");
}

function isSystemFlaw(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("system ran into an issue") || lower.includes("partner home");
}

function pickPart(
  request: WayfairSubmitProductAdditionsRequest,
  supplierPartNumber: string | null
) {
  for (const addition of request.proposedProductAdditions) {
    for (const part of addition.parts) {
      if (!supplierPartNumber || part.supplierPartNumber === supplierPartNumber) {
        return part;
      }
    }
  }
  return request.proposedProductAdditions[0]?.parts[0];
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function findSpecValue(snapshot: AmazonProductSnapshot, hints: string[]) {
  const normalizedHints = hints.map(normalizeText);
  const specs = snapshot.productInformation?.specs ?? {};
  const features = snapshot.productInformation?.features ?? {};
  for (const [key, value] of Object.entries({ ...specs, ...features })) {
    const normalizedKey = normalizeText(key);
    if (normalizedHints.some((hint) => normalizedKey.includes(hint))) {
      return value;
    }
  }
  return null;
}

function parseFirstNumber(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  return match[0];
}

function parseDimensions(value: string) {
  const matches = value.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 3) {
    return null;
  }
  return matches.slice(0, 3);
}

function buildFallbackAnswers(input: {
  question: WayfairProductAdditionQuestion;
  snapshot: AmazonProductSnapshot;
  supplierPartNumber?: string | null;
}) {
  const id = input.question.id.toLowerCase();
  const possible = input.question.possibleAnswers?.map((item) => item.value) ?? [];
  const pickDefaultChoice = () => {
    const candidates = ["does not apply", "not applicable", "n/a"];
    const match = possible.find((value) =>
      candidates.includes(normalizeText(value))
    );
    return match ?? null;
  };

  if (id.includes("core::manufacturerpartnumber")) {
    const specValue =
      findSpecValue(input.snapshot, ["manufacturer part number", "mpn", "part number"]) ??
      input.snapshot.asin;
    return specValue ? [{ questionId: input.question.id, value: specValue }] : [];
  }

  if (id.includes("shippingandfulfillment::leadtime")) {
    const hintValue = findSpecValue(input.snapshot, [
      "lead time",
      "ships in",
      "ship in",
      "delivery time",
      "processing time"
    ]);
    const numberValue = hintValue ? parseFirstNumber(hintValue) : null;
    return numberValue ? [{ questionId: input.question.id, value: numberValue }] : [];
  }
  if (id.includes("shippingandfulfillment::weight")) {
    const hintValue = findSpecValue(input.snapshot, ["shipping weight", "item weight", "weight"]);
    const numberValue = hintValue ? parseFirstNumber(hintValue) : null;
    return numberValue ? [{ questionId: input.question.id, value: numberValue }] : [];
  }
  if (
    id.includes("shippingandfulfillment::width") ||
    id.includes("shippingandfulfillment::height") ||
    id.includes("shippingandfulfillment::depth")
  ) {
    const hintValue = findSpecValue(input.snapshot, ["package dimensions", "carton dimensions"]);
    const dimensions = hintValue ? parseDimensions(hintValue) : null;
    if (dimensions) {
      const [length, width, height] = dimensions;
      if (id.includes("width")) {
        return [{ questionId: input.question.id, value: width }];
      }
      if (id.includes("height")) {
        return [{ questionId: input.question.id, value: height }];
      }
      if (id.includes("depth")) {
        return [{ questionId: input.question.id, value: length }];
      }
    }
  }

  if (input.question.isNotApplicableEligible && possible.length > 0) {
    const defaultChoice = pickDefaultChoice();
    if (defaultChoice) {
      return [{ questionId: input.question.id, value: defaultChoice }];
    }
  }

  return [];
}

export function reduceWayfairFlaws(input: {
  request: WayfairSubmitProductAdditionsRequest;
  questions: WayfairProductAdditionQuestion[];
  submissions: WayfairProductAdditionSubmission[];
  snapshot?: AmazonProductSnapshot | null;
}): ReducerResult {
  const questionMap = new Map(
    flattenQuestions(input.questions).map((question) => [question.id, question])
  );
  const touched = new Set<string>();
  let removedAnswers = 0;
  let normalizedAnswers = 0;
  let fixedRanks = 0;
  let appliedFixes = 0;
  let unresolvedFlaws = 0;
  let unrepairableFlaws = 0;
  const suggestions: RepairSuggestion[] = [];
  const flaws = flattenFlaws(input.submissions);
  const next: WayfairSubmitProductAdditionsRequest = {
    ...input.request,
    proposedProductAdditions: input.request.proposedProductAdditions.map((addition) => ({
      ...addition,
      parts: addition.parts.map((part) => {
        const normalized = normalizeAnswersForPart(part.answers, questionMap, touched);
        removedAnswers += normalized.removedAnswers;
        normalizedAnswers += normalized.normalizedAnswers;
        fixedRanks += normalized.fixedRanks;
        return {
          ...part,
          answers: normalized.answers
        };
      })
    }))
  };

  if (flaws.length === 0) {
    return {
      changed: false,
      repairable: false,
      request: next,
      summary: {
        removedAnswers,
        normalizedAnswers,
        fixedRanks,
        appliedFixes,
        unresolvedFlaws,
        unrepairableFlaws,
        touchedQuestions: Array.from(touched)
      },
      suggestions
    };
  }

  const derivedAnswers = input.snapshot
    ? deriveAnswersFromSnapshot({
        snapshot: input.snapshot,
        questions: input.questions,
        skipQuestionIds: new Set()
      })
    : [];
  const derivedByQuestion = new Map<string, WayfairAnswer[]>();
  for (const answer of derivedAnswers) {
    const list = derivedByQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    derivedByQuestion.set(answer.questionId, list);
  }

  for (const flaw of flaws) {
    const question = questionMap.get(flaw.questionId);
    if (!question) {
      unresolvedFlaws += 1;
      suggestions.push({
        questionId: flaw.questionId,
        flawType: flaw.flawType,
        flaw: flaw.flaw,
        repairable: false,
        reason: "questionId 未找到，无法修复"
      });
      unrepairableFlaws += 1;
      continue;
    }
    if (isSystemFlaw(flaw.flaw)) {
      unrepairableFlaws += 1;
      suggestions.push({
        questionId: flaw.questionId,
        flawType: flaw.flawType,
        flaw: flaw.flaw,
        repairable: false,
        reason: "Wayfair 系统错误，需人工处理"
      });
      continue;
    }
    const targetPart = pickPart(next, flaw.supplierPartNumber);
    if (!targetPart) {
      unresolvedFlaws += 1;
      suggestions.push({
        questionId: flaw.questionId,
        flawType: flaw.flawType,
        flaw: flaw.flaw,
        repairable: false,
        reason: "未找到目标 Part"
      });
      unrepairableFlaws += 1;
      continue;
    }
    const existingAnswers = targetPart.answers.filter((answer) => answer.questionId === question.id);

    if (isMissingFlaw(flaw.flaw)) {
      const derived = derivedByQuestion.get(question.id) ?? [];
      if (derived.length === 0) {
        const fallback = input.snapshot
          ? buildFallbackAnswers({
              question,
              snapshot: input.snapshot,
              supplierPartNumber: targetPart.supplierPartNumber
            })
          : [];
        const normalizedFallback = fallback
          .map((answer) => {
            const normalized = normalizeAnswerValue(String(answer.value ?? ""), question);
            if (!normalized) {
              return null;
            }
            return { ...answer, value: normalized };
          })
          .filter(Boolean) as WayfairAnswer[];
        if (normalizedFallback.length === 0) {
          unresolvedFlaws += 1;
          unrepairableFlaws += 1;
          suggestions.push({
            questionId: question.id,
            flawType: flaw.flawType,
            flaw: flaw.flaw,
            repairable: false,
            reason: "缺少可靠数据，无法自动补齐"
          });
          continue;
        }
        targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
        normalizedFallback.forEach((answer) => {
          targetPart.answers.push({
            questionId: answer.questionId,
            value: answer.value,
            parentRank: answer.parentRank,
            rank: answer.rank
          });
        });
        appliedFixes += 1;
        touched.add(question.id);
        suggestions.push({
          questionId: question.id,
          flawType: flaw.flawType,
          flaw: flaw.flaw,
          repairable: true,
          reason: "使用默认/兜底值补齐",
          suggestedValues: normalizedFallback.map((answer) => answer.value)
        });
        continue;
      }
      targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
      derived.forEach((answer) => {
        targetPart.answers.push({
          questionId: answer.questionId,
          value: answer.value,
          parentRank: answer.parentRank,
          rank: answer.rank
        });
      });
      appliedFixes += 1;
      touched.add(question.id);
      suggestions.push({
        questionId: question.id,
        flawType: flaw.flawType,
        flaw: flaw.flaw,
        repairable: true,
        reason: "使用快照字段补齐",
        suggestedValues: derived.map((answer) => answer.value)
      });
      continue;
    }

    if (isChoiceFlaw(flaw.flaw)) {
      const possible = question.possibleAnswers?.map((item) => item.value) ?? [];
      const normalized = existingAnswers
        .map((answer) => normalizeChoiceValue(String(answer.value ?? ""), possible))
        .filter(Boolean) as string[];
      if (normalized.length > 0) {
        targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
        normalized.forEach((value, index) => {
          const entry: WayfairAnswer = {
            questionId: question.id,
            value
          };
          if (question.isMultiValue || question.answerType === "MULTI_CHOICE") {
            entry.parentRank = index + 1;
            if (question.answerType === "MULTI_CHOICE") {
              entry.rank = index + 1;
            }
          }
          targetPart.answers.push(entry);
        });
        appliedFixes += 1;
        touched.add(question.id);
        suggestions.push({
          questionId: question.id,
          flawType: flaw.flawType,
          flaw: flaw.flaw,
          repairable: true,
          reason: "choice 值已规范化",
          suggestedValues: normalized
        });
        continue;
      }
      const defaultValue = possible.find(
        (value) => value.toLowerCase() === "does not apply"
      );
      if (defaultValue && flaw.flaw.toLowerCase().includes("does not apply")) {
        targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
        targetPart.answers.push({ questionId: question.id, value: defaultValue });
        appliedFixes += 1;
        touched.add(question.id);
        suggestions.push({
          questionId: question.id,
          flawType: flaw.flawType,
          flaw: flaw.flaw,
          repairable: true,
          reason: "按条件设置为 Does Not Apply",
          suggestedValues: [defaultValue]
        });
        continue;
      }
      const derived = derivedByQuestion.get(question.id) ?? [];
      if (derived.length > 0) {
        targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
        derived.forEach((answer) => {
          targetPart.answers.push({
            questionId: answer.questionId,
            value: answer.value,
            parentRank: answer.parentRank,
            rank: answer.rank
          });
        });
        appliedFixes += 1;
        touched.add(question.id);
        suggestions.push({
          questionId: question.id,
          flawType: flaw.flawType,
          flaw: flaw.flaw,
          repairable: true,
          reason: "使用快照字段修正 choice",
          suggestedValues: derived.map((answer) => answer.value)
        });
        continue;
      }
      unresolvedFlaws += 1;
      unrepairableFlaws += 1;
      suggestions.push({
        questionId: question.id,
        flawType: flaw.flawType,
        flaw: flaw.flaw,
        repairable: false,
        reason: "无法匹配合法选项"
      });
      continue;
    }

    if (question.answerType && (question.answerType === "INTEGER" || question.answerType === "DECIMAL")) {
      const normalized = existingAnswers
        .map((answer) => normalizeAnswerValue(String(answer.value ?? ""), question))
        .filter(Boolean) as string[];
      if (normalized.length > 0) {
        targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
        normalized.forEach((value, index) => {
          const entry: WayfairAnswer = { questionId: question.id, value };
          if (question.isMultiValue) {
            entry.parentRank = index + 1;
          }
          targetPart.answers.push(entry);
        });
        appliedFixes += 1;
        touched.add(question.id);
        suggestions.push({
          questionId: question.id,
          flawType: flaw.flawType,
          flaw: flaw.flaw,
          repairable: true,
          reason: "数值已规范化",
          suggestedValues: normalized
        });
        continue;
      }
    }

    if (isRankFlaw(flaw.flaw) && existingAnswers.length > 1) {
      targetPart.answers = targetPart.answers.filter((answer) => answer.questionId !== question.id);
      existingAnswers.forEach((answer, index) => {
        const entry: WayfairAnswer = {
          questionId: question.id,
          value: answer.value,
          parentRank: index + 1
        };
        if (question.answerType === "MULTI_CHOICE") {
          entry.rank = index + 1;
        }
        targetPart.answers.push(entry);
      });
      appliedFixes += 1;
      touched.add(question.id);
      suggestions.push({
        questionId: question.id,
        flawType: flaw.flawType,
        flaw: flaw.flaw,
        repairable: true,
        reason: "已重建 rank 顺序"
      });
      continue;
    }

    unresolvedFlaws += 1;
    unrepairableFlaws += 1;
    suggestions.push({
      questionId: question.id,
      flawType: flaw.flawType,
      flaw: flaw.flaw,
      repairable: false,
      reason: "未找到可靠修复策略"
    });
  }

  const summary = {
    removedAnswers,
    normalizedAnswers,
    fixedRanks,
    appliedFixes,
    unresolvedFlaws,
    unrepairableFlaws,
    touchedQuestions: Array.from(touched)
  };

  const changed =
    summary.removedAnswers > 0 ||
    summary.normalizedAnswers > 0 ||
    summary.fixedRanks > 0 ||
    summary.appliedFixes > 0;
  const repairable = changed && summary.unrepairableFlaws === 0;

  return { changed, repairable, request: next, summary, suggestions };
}
