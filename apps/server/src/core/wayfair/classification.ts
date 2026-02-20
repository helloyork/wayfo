import OpenAI from "openai";
import { getModelPool } from "../pools/registry";
import { getOpenAiApiKey } from "../store/settingsStore";
import {
  getWayfairClassifyCandidateLimit,
  getWayfairClassifyKeywordLimit,
  getWayfairClassifyModel
} from "../config";
import { extractKeywords } from "./keywords";
import { bm25Search, loadBm25Index, loadTaxonomyDocuments, tokenize } from "./taxonomySearch";
import type { AmazonProductSnapshot } from "../amazon/normalize";

export type WayfairClassCandidate = {
  classId: string;
  name: string;
  score: number;
  tokenHits: string[];
  path?: string | null;
  description?: string | null;
};

export type WayfairClassDecision = {
  classId: string;
  confidence: number;
  reasoning: string;
  fallbackClassId?: string | null;
};

export type WayfairClassifyResult = {
  keywords: string[];
  candidates: WayfairClassCandidate[];
  decision: WayfairClassDecision;
  model: string;
};

function buildProductSummary(snapshot: AmazonProductSnapshot) {
  const bullets = snapshot.bullets?.slice(0, 6) ?? [];
  const specs = Object.entries(snapshot.productInformation?.specs ?? {}).slice(0, 12);
  const features = Object.entries(snapshot.productInformation?.features ?? {}).slice(0, 8);
  return [
    `Title: ${snapshot.title}`,
    snapshot.brand ? `Brand: ${snapshot.brand}` : null,
    bullets.length ? `Bullets: ${bullets.join(" | ")}` : null,
    specs.length ? `Specs: ${specs.map(([k, v]) => `${k}: ${v}`).join(" | ")}` : null,
    features.length ? `Features: ${features.map(([k, v]) => `${k}: ${v}`).join(" | ")}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function mergeCandidatesWithDocs(
  candidates: ReturnType<typeof bm25Search>,
  docs: ReturnType<typeof loadTaxonomyDocuments>
) {
  const map = new Map(docs.map((doc) => [doc.classId, doc]));
  return candidates.map((candidate) => {
    const doc = map.get(candidate.classId);
    return {
      ...candidate,
      path: doc?.path ?? null,
      description: doc?.description ?? null
    };
  });
}

function parseJsonFromText(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed) as WayfairClassDecision;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const payload = trimmed.slice(start, end + 1);
    return JSON.parse(payload) as WayfairClassDecision;
  }
  throw new Error("LLM response missing JSON payload");
}

function validateDecision(decision: WayfairClassDecision, candidateIds: Set<string>) {
  if (!decision.classId || !candidateIds.has(String(decision.classId))) {
    throw new Error("LLM returned classId outside candidate list");
  }
  if (!Number.isFinite(decision.confidence)) {
    throw new Error("LLM returned invalid confidence");
  }
}

export async function classifyWayfairClass(input: {
  snapshot: AmazonProductSnapshot;
  taxonomyVersionDir: string;
}) {
  const index = loadBm25Index(input.taxonomyVersionDir);
  if (!index) {
    throw new Error("BM25 index missing for taxonomy");
  }
  const docs = loadTaxonomyDocuments(input.taxonomyVersionDir);
  const keywords = extractKeywords(
    {
      title: input.snapshot.title,
      brand: input.snapshot.brand,
      bullets: input.snapshot.bullets,
      specs: input.snapshot.productInformation?.specs,
      features: input.snapshot.productInformation?.features
    },
    getWayfairClassifyKeywordLimit()
  );
  const queryTokens = keywords.flatMap((token) => tokenize(token));
  const candidates = mergeCandidatesWithDocs(
    bm25Search(index, queryTokens, getWayfairClassifyCandidateLimit()),
    docs
  );
  if (candidates.length === 0) {
    throw new Error("未召回任何 taxonomy class 候选");
  }
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("缺少 OpenAI API Key，无法进行类目判定。");
  }

  const model = getWayfairClassifyModel();
  const openai = new OpenAI({ apiKey });
  const summary = buildProductSummary(input.snapshot);
  const candidateText = candidates
    .map(
      (candidate) =>
        `- ${candidate.classId} | ${candidate.name} | score=${candidate.score.toFixed(4)}`
    )
    .join("\n");
  const prompt = [
    "You are a Wayfair taxonomy expert.",
    "Select the single best classId from the candidates list.",
    "Return JSON only in the following format:",
    '{"classId":"<id>","confidence":0.0,"reasoning":"...","fallbackClassId":"<id or null>"}',
    "",
    "Product:",
    summary,
    "",
    "Candidates:",
    candidateText
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
    const message = completion.choices[0]?.message?.content ?? "";
    return message;
  });

  const decision = parseJsonFromText(response[0]);
  validateDecision(decision, new Set(candidates.map((candidate) => String(candidate.classId))));
  return {
    keywords,
    candidates,
    decision,
    model
  } satisfies WayfairClassifyResult;
}
