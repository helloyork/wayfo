import OpenAI from "openai";
import { getOpenAiApiKey } from "../store/settingsStore";
import { getModelPool } from "../pools/registry";
import { log } from "../logger";
import type { AmazonProductSnapshot } from "../amazon/normalize";

export type RewrittenContent = {
  productName: string;
  description: string;
  bullets: string[];
  model: string;
  cost: number;
};

export type ContentRewriteResult = {
  success: boolean;
  content?: RewrittenContent;
  error?: string;
};

const REWRITE_SYSTEM_PROMPT = `You are an expert e-commerce copywriter specializing in product descriptions for home goods and furniture marketplaces like Wayfair.

Your writing style must be:
- Natural and conversational, like a knowledgeable sales associate
- SEO-friendly with relevant keywords naturally integrated
- Engaging and persuasive without being pushy
- Professional but warm and approachable

CRITICAL RULES:
1. NEVER use em dashes (—) or en dashes (–). Use commas, periods, or "and" instead.
2. NEVER use bullet point symbols or dashes at the start of feature bullets
3. Avoid AI-sounding phrases like "elevate your space", "transform your home", "seamlessly", "effortlessly", "boasts", "features a"
4. Avoid robotic patterns like "This [product] is perfect for...", "Whether you're..."
5. Write like a real person, not a template
6. Keep the original factual information accurate (dimensions, materials, etc.)
7. Each bullet point should be a complete sentence starting with a capital letter
8. Do not start bullet points with verbs in imperative form`;

const REWRITE_USER_PROMPT = `Rewrite the following product content for a Wayfair listing. Keep all factual information accurate but make it more engaging and SEO-friendly.

Product Title: {title}

Original Description:
{description}

Original Feature Bullets:
{bullets}

Product Specifications:
{specs}

Return your response as JSON with this exact structure:
{
  "productName": "Rewritten product title (max 200 chars, include key features/materials)",
  "description": "Rewritten marketing description (150-500 words, natural paragraphs, no dashes)",
  "bullets": ["Feature 1 as complete sentence", "Feature 2 as complete sentence", ...]
}

Remember:
- NO dashes (— or –) anywhere
- NO bullet symbols or leading dashes in bullets array
- Each bullet is a standalone sentence
- Write naturally, avoid AI clichés`;

function formatBullets(bullets: string[] | undefined): string {
  if (!bullets || bullets.length === 0) {
    return "No feature bullets provided";
  }
  return bullets.map((b, i) => `${i + 1}. ${b}`).join("\n");
}

function formatSpecs(specs: Record<string, string>): string {
  const entries = Object.entries(specs);
  if (entries.length === 0) {
    return "No specifications provided";
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

function cleanRewrittenContent(content: {
  productName?: string;
  description?: string;
  bullets?: string[];
}): RewrittenContent {
  const cleanText = (text: string): string => {
    return text
      .replace(/—/g, ",")
      .replace(/–/g, ",")
      .replace(/\s*[-•]\s*/g, " ")
      .trim();
  };

  const cleanBullet = (bullet: string): string => {
    let cleaned = bullet.trim();
    cleaned = cleaned.replace(/^[-•●◦▪▸►]\s*/, "");
    cleaned = cleaned.replace(/^[—–]\s*/, "");
    cleaned = cleanText(cleaned);
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    if (cleaned.length > 0 && !cleaned.endsWith(".") && !cleaned.endsWith("!") && !cleaned.endsWith("?")) {
      cleaned += ".";
    }
    return cleaned;
  };

  return {
    productName: cleanText(content.productName ?? ""),
    description: cleanText(content.description ?? ""),
    bullets: (content.bullets ?? []).map(cleanBullet).filter((b) => b.length > 0),
    model: "",
    cost: 0
  };
}

export async function rewriteProductContent(input: {
  runId: string;
  snapshot: AmazonProductSnapshot;
}): Promise<ContentRewriteResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { success: false, error: "OpenAI API Key not configured" };
  }

  const openai = new OpenAI({ apiKey });
  const pool = getModelPool();
  const model = "gpt-4o-mini";

  const userPrompt = REWRITE_USER_PROMPT
    .replace("{title}", input.snapshot.title)
    .replace("{description}", input.snapshot.description ?? "No description provided")
    .replace("{bullets}", formatBullets(input.snapshot.bullets))
    .replace("{specs}", formatSpecs(input.snapshot.productInformation?.specs ?? {}));

  try {
    const result = await pool.run([userPrompt], async (prompt) => {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: REWRITE_SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      const cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;

      return { content, cost };
    });

    const { content, cost } = result[0];

    let parsed: { productName?: string; description?: string; bullets?: string[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      log({
        level: "warn",
        runId: input.runId,
        message: "Failed to parse content rewrite response",
        err: { content }
      });
      return { success: false, error: "Failed to parse rewrite response" };
    }

    const cleaned = cleanRewrittenContent(parsed);
    cleaned.model = model;
    cleaned.cost = cost;

    if (!cleaned.productName) {
      cleaned.productName = input.snapshot.title;
    }
    if (!cleaned.description) {
      cleaned.description = input.snapshot.description ?? "";
    }
    if (cleaned.bullets.length === 0 && input.snapshot.bullets) {
      cleaned.bullets = input.snapshot.bullets.slice(0, 6);
    }

    log({
      level: "info",
      runId: input.runId,
      message: "Content rewrite completed",
      err: {
        originalTitleLength: input.snapshot.title.length,
        rewrittenTitleLength: cleaned.productName.length,
        originalBullets: input.snapshot.bullets?.length ?? 0,
        rewrittenBullets: cleaned.bullets.length,
        cost
      }
    });

    return { success: true, content: cleaned };
  } catch (error) {
    log({
      level: "error",
      runId: input.runId,
      message: "Content rewrite failed",
      err: { error: String(error) }
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
