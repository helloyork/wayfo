import type {
  WayfairAnswer,
  WayfairProductAdditionQuestion,
  WayfairQuestionAnswerType
} from "@wayfo/shared";
import type { AmazonProductSnapshot } from "../amazon/normalize";

type DerivedValue = {
  values: string[];
  evidence: string[];
};

type NormalizedAnswerResult = {
  answers: WayfairAnswer[];
  removedAnswers: number;
  normalizedAnswers: number;
  fixedRanks: number;
};

const coreQuestionIds = new Set([
  "core::manufacturerId",
  "core::supplierPartNumber",
  "core::productName",
  "core::amazonStandardIdentificationNumber",
  "featureDescription::genericFeatures",
  "featureDescription::romanceCopy",
  "media::imageValue"
]);

export function flattenQuestions(questions: WayfairProductAdditionQuestion[]) {
  const result: WayfairProductAdditionQuestion[] = [];
  const visit = (question: WayfairProductAdditionQuestion) => {
    result.push(question);
    question.childQuestions?.forEach(visit);
  };
  questions.forEach(visit);
  return result;
}

export function isChoiceType(answerType: WayfairQuestionAnswerType | null) {
  return answerType === "SINGLE_CHOICE" || answerType === "MULTI_CHOICE" || answerType === "ENUM";
}

export function normalizeChoiceValue(value: string, possible: string[]) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (possible.includes(trimmed)) {
    return trimmed;
  }
  const lowered = trimmed.toLowerCase();
  const match = possible.find((item) => item.toLowerCase() === lowered);
  return match ?? null;
}

export function normalizeBooleanValue(value: string, possible: string[]) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (possible.length === 0) {
    if (trimmed === "true" || trimmed === "false") {
      return trimmed;
    }
    if (trimmed === "yes" || trimmed === "no") {
      return trimmed === "yes" ? "true" : "false";
    }
    return null;
  }
  const match = possible.find((item) => item.toLowerCase() === trimmed);
  if (match) {
    return match;
  }
  if (trimmed === "true" || trimmed === "false") {
    const alt = trimmed === "true" ? "yes" : "no";
    return possible.find((item) => item.toLowerCase() === alt) ?? null;
  }
  if (trimmed === "yes" || trimmed === "no") {
    const alt = trimmed === "yes" ? "true" : "false";
    return possible.find((item) => item.toLowerCase() === alt) ?? null;
  }
  return null;
}

export function normalizeNumericValue(value: string, answerType: WayfairQuestionAnswerType | null) {
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const numberValue = match[0];
  if (answerType === "INTEGER") {
    const parsed = Number.parseInt(numberValue, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return String(parsed);
  }
  if (answerType === "DECIMAL") {
    const parsed = Number(numberValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return String(parsed);
  }
  return numberValue;
}

export function normalizeAnswerValue(
  value: string,
  question: WayfairProductAdditionQuestion
) {
  const possible = question.possibleAnswers?.map((item) => item.value) ?? [];
  if (question.answerType === "BOOLEAN") {
    return normalizeBooleanValue(value, possible);
  }
  if (isChoiceType(question.answerType)) {
    return normalizeChoiceValue(value, possible);
  }
  if (question.answerType === "INTEGER" || question.answerType === "DECIMAL") {
    return normalizeNumericValue(value, question.answerType);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAnswersForPart(
  answers: WayfairAnswer[],
  questionMap: Map<string, WayfairProductAdditionQuestion>,
  touched: Set<string>
): NormalizedAnswerResult {
  const grouped = new Map<string, WayfairAnswer[]>();
  let removedAnswers = 0;
  let normalizedAnswers = 0;
  let fixedRanks = 0;

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question || !question.isActive || coreQuestionIds.has(answer.questionId)) {
      removedAnswers += 1;
      continue;
    }
    const normalized = normalizeAnswerValue(String(answer.value ?? ""), question);
    if (!normalized) {
      removedAnswers += 1;
      touched.add(answer.questionId);
      continue;
    }
    if (normalized !== answer.value) {
      normalizedAnswers += 1;
      touched.add(answer.questionId);
    }
    const next = grouped.get(answer.questionId) ?? [];
    next.push({
      questionId: answer.questionId,
      value: normalized
    });
    grouped.set(answer.questionId, next);
  }

  const result: WayfairAnswer[] = [];
  for (const [questionId, entries] of grouped.entries()) {
    const question = questionMap.get(questionId);
    if (!question) {
      continue;
    }
    if (!question.isMultiValue && question.answerType !== "MULTI_CHOICE") {
      result.push({ questionId, value: entries[0].value });
      continue;
    }
    entries.forEach((entry, index) => {
      const parentRank = index + 1;
      const rank = question.answerType === "MULTI_CHOICE" ? index + 1 : undefined;
      if (entry.parentRank !== parentRank || (rank && entry.rank !== rank)) {
        fixedRanks += 1;
        touched.add(questionId);
      }
      result.push({
        questionId,
        value: entry.value,
        parentRank,
        rank
      });
    });
  }

  return { answers: result, removedAnswers, normalizedAnswers, fixedRanks };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function buildKeyMap(record: Record<string, string>) {
  return Object.entries(record)
    .map(([key, value]) => ({
      key,
      normalizedKey: normalizeKey(key),
      value: value?.trim()
    }))
    .filter((entry) => Boolean(entry.value));
}

function findSpecValue(
  entries: ReturnType<typeof buildKeyMap>,
  hints: string[],
  qualifiers?: string[]
) {
  const normalizedHints = hints.map((hint) => hint.toLowerCase());
  const normalizedQualifiers = qualifiers?.map((hint) => hint.toLowerCase()) ?? [];
  return entries.find((entry) => {
    const hit = normalizedHints.some((hint) => entry.normalizedKey.includes(hint));
    if (!hit) {
      return false;
    }
    if (normalizedQualifiers.length === 0) {
      return true;
    }
    return normalizedQualifiers.some((hint) => entry.normalizedKey.includes(hint));
  });
}

function matchFromPossibleAnswers(raw: string, question: WayfairProductAdditionQuestion) {
  const possible = question.possibleAnswers?.map((item) => item.value) ?? [];
  if (possible.length === 0) {
    return null;
  }
  const candidates = raw
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const matched = candidates
    .map((candidate) => normalizeChoiceValue(candidate, possible))
    .filter(Boolean) as string[];
  if (matched.length === 0) {
    const single = normalizeChoiceValue(raw, possible);
    return single ? [single] : null;
  }
  return Array.from(new Set(matched));
}

function deriveValueFromSnapshot(
  question: WayfairProductAdditionQuestion,
  snapshot: AmazonProductSnapshot
): DerivedValue | null {
  const specs = buildKeyMap(snapshot.productInformation?.specs ?? {});
  const features = buildKeyMap(snapshot.productInformation?.features ?? {});
  const display = question.displayName?.toLowerCase() ?? "";
  const questionId = question.id?.toLowerCase() ?? "";

  const directMap: Array<{
    match: (id: string, displayName: string) => boolean;
    hints: string[];
    qualifiers?: string[];
  }> = [
    {
      match: (id, name) => id.includes("color") || name.includes("color") || name.includes("colour"),
      hints: ["color", "colour", "color family", "colour family", "finish color"]
    },
    {
      match: (id, name) => id.includes("material") || name.includes("material"),
      hints: ["material", "materials", "fabric", "fabric type"]
    },
    {
      match: (_id, name) => name.includes("finish"),
      hints: ["finish"]
    },
    {
      match: (_id, name) => name.includes("style"),
      hints: ["style"]
    },
    {
      match: (_id, name) => name.includes("shape"),
      hints: ["shape"]
    },
    {
      match: (id, _name) => id.includes("core::universalproductcode"),
      hints: ["upc", "universal product code"]
    },
    {
      match: (id, _name) => id.includes("core::manufacturerpartnumber"),
      hints: ["manufacturer part number", "mpn"]
    },
    {
      match: (id, name) =>
        id.includes("shippingandfulfillment::weight") || name.includes("shipping weight"),
      hints: ["weight"],
      qualifiers: ["shipping", "package", "carton"]
    },
    {
      match: (id, name) =>
        id.includes("shippingandfulfillment::height") || name.includes("carton height"),
      hints: ["height"],
      qualifiers: ["shipping", "package", "carton"]
    },
    {
      match: (id, name) =>
        id.includes("shippingandfulfillment::width") || name.includes("carton width"),
      hints: ["width"],
      qualifiers: ["shipping", "package", "carton"]
    },
    {
      match: (id, name) =>
        id.includes("shippingandfulfillment::depth") || name.includes("carton depth"),
      hints: ["depth", "length"],
      qualifiers: ["shipping", "package", "carton"]
    }
  ];

  for (const rule of directMap) {
    if (!rule.match(questionId, display)) {
      continue;
    }
    const entry = findSpecValue(specs, rule.hints, rule.qualifiers)
      ?? findSpecValue(features, rule.hints, rule.qualifiers);
    if (!entry?.value) {
      continue;
    }
    return {
      values: [entry.value],
      evidence: [`${entry.key}: ${entry.value}`]
    };
  }
  return null;
}

export function deriveAnswersFromSnapshot(input: {
  snapshot: AmazonProductSnapshot;
  questions: WayfairProductAdditionQuestion[];
  skipQuestionIds?: Set<string>;
}) {
  const results: Array<WayfairAnswer & { evidence: string[] }> = [];
  const skipped = input.skipQuestionIds ?? new Set<string>();
  const flattened = flattenQuestions(input.questions);
  for (const question of flattened) {
    if (!question.isActive || skipped.has(question.id) || coreQuestionIds.has(question.id)) {
      continue;
    }
    const derived = deriveValueFromSnapshot(question, input.snapshot);
    if (!derived) {
      continue;
    }
    const possible = question.possibleAnswers?.map((item) => item.value) ?? [];
    if (isChoiceType(question.answerType)) {
      const matched = matchFromPossibleAnswers(derived.values.join(" "), question);
      if (!matched) {
        continue;
      }
      matched.forEach((value, index) => {
        const entry: WayfairAnswer & { evidence: string[] } = {
          questionId: question.id,
          value,
          evidence: derived.evidence
        };
        if (question.isMultiValue || question.answerType === "MULTI_CHOICE") {
          entry.parentRank = index + 1;
          if (question.answerType === "MULTI_CHOICE") {
            entry.rank = index + 1;
          }
        }
        results.push(entry);
      });
      continue;
    }
    if (question.answerType === "BOOLEAN") {
      const normalized = normalizeBooleanValue(derived.values[0], possible);
      if (!normalized) {
        continue;
      }
      results.push({
        questionId: question.id,
        value: normalized,
        evidence: derived.evidence
      });
      continue;
    }
    if (question.answerType === "INTEGER" || question.answerType === "DECIMAL") {
      const normalized = normalizeNumericValue(derived.values[0], question.answerType);
      if (!normalized) {
        continue;
      }
      results.push({
        questionId: question.id,
        value: normalized,
        evidence: derived.evidence
      });
      continue;
    }
    const textValue = derived.values[0].trim();
    if (!textValue) {
      continue;
    }
    results.push({
      questionId: question.id,
      value: textValue,
      evidence: derived.evidence
    });
  }
  return results;
}
