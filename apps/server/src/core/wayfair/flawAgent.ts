import OpenAI from "openai";
import type {
  WayfairAnswer,
  WayfairProductAdditionQuestion,
  WayfairValidationFlaw
} from "@wayfo/shared";
import { getModelPool } from "../pools/registry";
import { getOpenAiApiKey } from "../store/settingsStore";
import { getWayfairAnswerModel } from "../config";
import type { AmazonProductSnapshot } from "../amazon/normalize";
import {
  flattenQuestions,
  isChoiceType,
  normalizeAnswerValue
} from "./answerRules";

export type FlawRepairResult = {
  repaired: boolean;
  answers: WayfairAnswer[];
  confidence: number;
  evidence: string[];
  reason: string;
};

export type FlawAgentResult = {
  questionId: string;
  supplierPartNumber?: string | null;
  flaw: string;
  result: FlawRepairResult;
};

type AgentOutput = {
  answers: WayfairAnswer[];
  confidence: number;
  evidence: string[];
  reasoning: string;
  canRepair: boolean;
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
    ? `Possible values: ${question.possibleAnswers.map((item) => item.value).join(" | ")}`
    : "Possible values: (free text)";
  return [
    `Question ID: ${question.id}`,
    `Display Name: ${question.displayName}`,
    `Answer Type: ${question.answerType ?? "STRING"}`,
    `Multi-value: ${question.isMultiValue ? "yes" : "no"}`,
    question.importanceType ? `Importance: ${question.importanceType}` : null,
    possible
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJsonFromText(text: string): AgentOutput {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as AgentOutput;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as AgentOutput;
  }
  throw new Error("LLM response missing JSON payload");
}

function validateAnswer(
  answer: WayfairAnswer,
  question: WayfairProductAdditionQuestion
): WayfairAnswer | null {
  const value = normalizeAnswerValue(String(answer.value ?? ""), question);
  if (!value) {
    return null;
  }

  const possible = question.possibleAnswers?.map((item) => item.value) ?? [];
  if (isChoiceType(question.answerType) && possible.length > 0 && !possible.includes(value)) {
    return null;
  }

  if (question.answerType === "INTEGER" && !Number.isFinite(Number.parseInt(value, 10))) {
    return null;
  }

  if (question.answerType === "DECIMAL" && !Number.isFinite(Number(value))) {
    return null;
  }

  if (question.answerType === "BOOLEAN" && possible.length > 0 && !possible.includes(value)) {
    return null;
  }

  return { ...answer, value };
}

export async function repairFlawWithAgent(input: {
  flaw: WayfairValidationFlaw;
  question: WayfairProductAdditionQuestion;
  snapshot: AmazonProductSnapshot;
  existingAnswers: WayfairAnswer[];
}): Promise<FlawRepairResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return {
      repaired: false,
      answers: [],
      confidence: 0,
      evidence: [],
      reason: "Missing OpenAI API Key"
    };
  }

  const model = getWayfairAnswerModel();
  const openai = new OpenAI({ apiKey });

  const existingAnswerValues = input.existingAnswers
    .filter((a) => a.questionId === input.question.id)
    .map((a) => a.value);

  const prompt = [
    "You are a Wayfair catalog expert helping to fix validation errors.",
    "",
    "A product submission failed with a validation flaw. Your task is to analyze the error and provide a corrected answer.",
    "",
    "## Validation Flaw",
    `Question ID: ${input.flaw.questionId}`,
    `Error Type: ${input.flaw.flawType}`,
    `Error Message: ${input.flaw.flaw}`,
    "",
    "## Question Details",
    questionSummary(input.question),
    "",
    "## Current Answer Value(s)",
    existingAnswerValues.length > 0 ? existingAnswerValues.join(", ") : "(no current value)",
    "",
    "## Product Information",
    buildProductSummary(input.snapshot),
    "",
    "## Instructions",
    "1. Analyze the validation error and understand what's wrong",
    "2. Look at the product information to find the correct value",
    "3. If the question requires a choice from possible values, you MUST select from those values exactly",
    "4. If you cannot find reliable data to fix this, set canRepair to false",
    "5. For multi-value answers, include parentRank starting from 1",
    "6. For MULTI_CHOICE, also include rank starting from 1",
    "",
    "## Response Format (JSON only)",
    JSON.stringify({
      answers: [{ questionId: "...", value: "...", parentRank: 1, rank: 1 }],
      confidence: 0.0,
      evidence: ["source of the value"],
      reasoning: "explanation of the fix",
      canRepair: true
    }, null, 2)
  ].join("\n");

  try {
    const pool = getModelPool();
    const response = await pool.run([prompt], async (content) => {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "Return JSON only. Do not include markdown code blocks." },
          { role: "user", content }
        ],
        temperature: 0.1
      });
      return completion.choices[0]?.message?.content ?? "";
    });

    const parsed = parseJsonFromText(response[0]);

    if (!parsed.canRepair) {
      return {
        repaired: false,
        answers: [],
        confidence: parsed.confidence ?? 0,
        evidence: parsed.evidence ?? [],
        reason: parsed.reasoning ?? "Agent determined the flaw cannot be repaired"
      };
    }

    const validatedAnswers: WayfairAnswer[] = [];
    for (const answer of parsed.answers ?? []) {
      const validated = validateAnswer(answer, input.question);
      if (validated) {
        validatedAnswers.push(validated);
      }
    }

    if (validatedAnswers.length === 0) {
      return {
        repaired: false,
        answers: [],
        confidence: 0,
        evidence: parsed.evidence ?? [],
        reason: "Agent provided invalid answer values"
      };
    }

    return {
      repaired: true,
      answers: validatedAnswers,
      confidence: parsed.confidence ?? 0.5,
      evidence: parsed.evidence ?? [],
      reason: parsed.reasoning ?? "Agent repair successful"
    };
  } catch (error) {
    return {
      repaired: false,
      answers: [],
      confidence: 0,
      evidence: [],
      reason: error instanceof Error ? error.message : "Agent repair failed"
    };
  }
}

export async function repairFlawsWithAgent(input: {
  flaws: Array<WayfairValidationFlaw & { supplierPartNumber?: string | null }>;
  questions: WayfairProductAdditionQuestion[];
  snapshot: AmazonProductSnapshot;
  existingAnswers: WayfairAnswer[];
  maxFlaws?: number;
}): Promise<FlawAgentResult[]> {
  const questionMap = new Map(
    flattenQuestions(input.questions).map((q) => [q.id, q])
  );

  const results: FlawAgentResult[] = [];
  const flawsToProcess = input.flaws.slice(0, input.maxFlaws ?? 5);

  for (const flaw of flawsToProcess) {
    const question = questionMap.get(flaw.questionId);
    if (!question) {
      results.push({
        questionId: flaw.questionId,
        supplierPartNumber: flaw.supplierPartNumber ?? null,
        flaw: flaw.flaw,
        result: {
          repaired: false,
          answers: [],
          confidence: 0,
          evidence: [],
          reason: "Question not found"
        }
      });
      continue;
    }

    const result = await repairFlawWithAgent({
      flaw,
      question,
      snapshot: input.snapshot,
      existingAnswers: input.existingAnswers
    });

    results.push({
      questionId: flaw.questionId,
      supplierPartNumber: flaw.supplierPartNumber ?? null,
      flaw: flaw.flaw,
      result
    });
  }

  return results;
}
