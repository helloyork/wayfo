import { z } from "zod";
import type { AgentModifiers } from "@wayfo/shared";
import {
  WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM,
  WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS,
  WAYFAIR_ANSWERS_MODIFIER_MAX_TOTAL_CHARS
} from "@wayfo/shared";

/** Request body shape for API (use `.optional()` on the parent key for inference). */
export const AgentModifiersPayloadSchema = z.object({
  wayfairAnswers: z
    .array(z.string().max(WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM))
    .max(WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS)
    .optional()
});

/** Standalone optional payload (e.g. nested). */
export const AgentModifiersRequestSchema = AgentModifiersPayloadSchema.optional();

/**
 * Normalize blocks: trim, drop empties, cap count and per-item length, then cap total concatenated length.
 */
export function sanitizeWayfairAnswersBlocks(
  raw: string[] | undefined | null
): string[] {
  if (!raw?.length) {
    return [];
  }
  const trimmed = raw
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS)
    .map((s) => s.slice(0, WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM));

  let total = 0;
  const out: string[] = [];
  for (const block of trimmed) {
    if (total + block.length > WAYFAIR_ANSWERS_MODIFIER_MAX_TOTAL_CHARS) {
      const room = WAYFAIR_ANSWERS_MODIFIER_MAX_TOTAL_CHARS - total;
      if (room <= 0) {
        break;
      }
      out.push(block.slice(0, room));
      break;
    }
    out.push(block);
    total += block.length;
  }
  return out;
}

export function sanitizeAgentModifiers(input: AgentModifiers | undefined | null): AgentModifiers | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const wayfairAnswers = sanitizeWayfairAnswersBlocks(input.wayfairAnswers);
  if (wayfairAnswers.length === 0) {
    return undefined;
  }
  return { wayfairAnswers };
}

/** Stable payload for hashing / idempotency (same normalization as prompt). */
export function wayfairAnswersModifiersForHash(
  globalBlocks: string[] | undefined,
  runBlocks: string[] | undefined
): { global: string[]; run: string[] } {
  return {
    global: sanitizeWayfairAnswersBlocks(globalBlocks),
    run: sanitizeWayfairAnswersBlocks(runBlocks)
  };
}

/**
 * Merge global + run Wayfair answer modifier blocks into one user-prompt section.
 */
export function mergeWayfairAnswersPromptModifier(
  globalBlocks: string[] | undefined,
  runBlocks: string[] | undefined
): string | undefined {
  const globals = sanitizeWayfairAnswersBlocks(globalBlocks);
  const runs = sanitizeWayfairAnswersBlocks(runBlocks);
  if (globals.length === 0 && runs.length === 0) {
    return undefined;
  }

  const parts: string[] = [];
  if (globals.length > 0) {
    parts.push("### Global operator instructions");
    globals.forEach((block, i) => {
      parts.push(`--- Global block ${i + 1} ---`, block);
    });
  }
  if (runs.length > 0) {
    parts.push("### Run-specific operator instructions");
    runs.forEach((block, i) => {
      parts.push(`--- Run block ${i + 1} ---`, block);
    });
  }

  let text = parts.join("\n\n");
  if (text.length > WAYFAIR_ANSWERS_MODIFIER_MAX_TOTAL_CHARS) {
    text = text.slice(0, WAYFAIR_ANSWERS_MODIFIER_MAX_TOTAL_CHARS);
  }
  return text;
}
