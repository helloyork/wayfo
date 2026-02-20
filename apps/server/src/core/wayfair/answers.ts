import OpenAI from "openai";
import { AgentResult, WayfairAnswer, WayfairProductAdditionQuestion } from "@wayfo/shared";
import { getModelPool } from "../pools/registry";
import { getOpenAiApiKey } from "../store/settingsStore";
import { getWayfairAnswerModel } from "../config";
import type { AmazonProductSnapshot } from "../amazon/normalize";
import {
  deriveAnswersFromSnapshot,
  flattenQuestions,
  isChoiceType,
  normalizeAnswerValue
} from "./answerRules";

type WayfairAnswerAgentOutput = {
  answers: WayfairAnswer[];
  confidence?: number;
  evidence?: string[];
  notes?: string;
};

function buildProductSummary(snapshot: AmazonProductSnapshot) {
  const bullets = snapshot.bullets?.slice(0, 8) ?? [];
  const specs = Object.entries(snapshot.productInformation?.specs ?? {}).slice(0, 18);
  const features = Object.entries(snapshot.productInformation?.features ?? {}).slice(0, 12);
  const description = snapshot.description ? snapshot.description.slice(0, 1200) : "";
  return [
    `Title: ${snapshot.title}`,
    snapshot.brand ? `Brand: ${snapshot.brand}` : null,
    bullets.length ? `Bullets: ${bullets.join(" | ")}` : null,
    specs.length ? `Specs: ${specs.map(([k, v]) => `${k}: ${v}`).join(" | ")}` : null,
    features.length
      ? `Features: ${features.map(([k, v]) => `${k}: ${v}`).join(" | ")}`
      : null,
    description ? `Description: ${description}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function questionSummary(question: WayfairProductAdditionQuestion) {
  const possible = question.possibleAnswers?.length
    ? `Possible: ${question.possibleAnswers.map((item) => item.value).join(" | ")}`
    : "Possible: []";
  return [
    `- id: ${question.id}`,
    `  display: ${question.displayName}`,
    `  type: ${question.answerType ?? "UNKNOWN"}`,
    `  multi: ${question.isMultiValue ? "yes" : "no"}`,
    question.importanceType ? `  importance: ${question.importanceType}` : null,
    `  ${possible}`
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJsonFromText(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as WayfairAnswerAgentOutput;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as WayfairAnswerAgentOutput;
  }
  throw new Error("LLM response missing JSON payload");
}

function validateAnswers(
  raw: WayfairAnswer[],
  questions: WayfairProductAdditionQuestion[],
  skipQuestionIds: Set<string>,
  filledQuestionIds: Set<string>
) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const grouped = new Map<string, WayfairAnswer[]>();
  for (const answer of raw) {
    const question = questionMap.get(answer.questionId);
    if (
      !question ||
      !question.isActive ||
      skipQuestionIds.has(answer.questionId) ||
      filledQuestionIds.has(answer.questionId)
    ) {
      continue;
    }
    const value = normalizeAnswerValue(String(answer.value ?? ""), question);
    if (!value) {
      continue;
    }
    const possible = question.possibleAnswers?.map((item) => item.value) ?? [];
    if (isChoiceType(question.answerType)) {
      if (possible.length > 0 && !possible.includes(value)) {
        continue;
      }
    }
    if (question.answerType === "INTEGER") {
      if (!Number.isFinite(Number.parseInt(value, 10))) {
        continue;
      }
    }
    if (question.answerType === "DECIMAL") {
      if (!Number.isFinite(Number(value))) {
        continue;
      }
    }
    if (question.answerType === "BOOLEAN" && possible.length > 0 && !possible.includes(value)) {
      continue;
    }
    const next = [...(grouped.get(answer.questionId) ?? [])];
    next.push({ ...answer, value });
    grouped.set(answer.questionId, next);
  }

  const results: WayfairAnswer[] = [];
  for (const [questionId, answers] of grouped.entries()) {
    const question = questionMap.get(questionId);
    if (!question) {
      continue;
    }
    if (!question.isMultiValue && question.answerType !== "MULTI_CHOICE") {
      results.push({ questionId, value: answers[0].value });
      continue;
    }
    answers.forEach((answer, index) => {
      const entry: WayfairAnswer = {
        questionId,
        value: answer.value,
        parentRank: index + 1
      };
      if (question.answerType === "MULTI_CHOICE") {
        entry.rank = index + 1;
      }
      results.push(entry);
    });
  }
  return results;
}

export async function generateWayfairAnswers(input: {
  snapshot: AmazonProductSnapshot;
  questions: WayfairProductAdditionQuestion[];
  skipQuestionIds?: string[];
}) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("缺少 OpenAI API Key，无法生成 Wayfair answers。");
  }
  const model = getWayfairAnswerModel();
  const openai = new OpenAI({ apiKey });
  const skipSet = new Set(input.skipQuestionIds ?? []);
  const flattened = flattenQuestions(input.questions);
  const ruleAnswers = deriveAnswersFromSnapshot({
    snapshot: input.snapshot,
    questions: flattened,
    skipQuestionIds: skipSet
  });
  const filledQuestionIds = new Set(ruleAnswers.map((answer) => answer.questionId));
  const llmQuestions = flattened.filter(
    (question) =>
      question.isActive &&
      !skipSet.has(question.id) &&
      !filledQuestionIds.has(question.id)
  );
  if (llmQuestions.length === 0) {
    return {
      data: {
        answers: ruleAnswers,
        skippedQuestionIds: Array.from(skipSet),
        ruleAnswerCount: ruleAnswers.length,
        llmAnswerCount: 0
      },
      confidence: 1,
      evidence: ruleAnswers.flatMap((answer) => (answer as { evidence?: string[] }).evidence ?? []),
      model
    } satisfies AgentResult;
  }
  const prompt = [
    "You are a Wayfair catalog expert.",
    "Fill answers for product addition questions using the product data.",
    "Follow rules:",
    "- Only answer questions provided in the list.",
    "- For SINGLE_CHOICE, MULTI_CHOICE, ENUM: value must be exactly one of the possible values.",
    "- For BOOLEAN: if possible values exist, use one of them exactly.",
    "- For INTEGER/DECIMAL: return a numeric string.",
    "- Skip any question if you are not confident or data is missing.",
    "- Return JSON only.",
    "",
    "Return JSON format:",
    '{"answers":[{"questionId":"...","value":"...","parentRank":1,"rank":1}],"confidence":0.0,"evidence":["..."],"notes":"..."}',
    "",
    "Product:",
    buildProductSummary(input.snapshot),
    "",
    "Questions:",
    llmQuestions.map(questionSummary).join("\n")
  ].join("\n");

  const pool = getModelPool();
  const response = await pool.run([prompt], async (content) => {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Return JSON only. Do not include markdown." },
        { role: "user", content }
      ],
      temperature: 0.2
    });
    return completion.choices[0]?.message?.content ?? "";
  });

  const parsed = parseJsonFromText(response[0]);
  const validated = validateAnswers(parsed.answers ?? [], llmQuestions, skipSet, filledQuestionIds);
  const combinedAnswers = [...ruleAnswers, ...validated];
  const result: AgentResult = {
    data: {
      answers: combinedAnswers,
      skippedQuestionIds: Array.from(skipSet),
      ruleAnswerCount: ruleAnswers.length,
      llmAnswerCount: validated.length
    },
    confidence: parsed.confidence,
    evidence: [
      ...(parsed.evidence ?? []),
      ...ruleAnswers.flatMap((answer) => (answer as { evidence?: string[] }).evidence ?? [])
    ],
    model,
    errors: parsed.notes ? { notes: parsed.notes } : undefined
  };
  return result;
}
