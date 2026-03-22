/**
 * OpenAI Images API (`images.edit`) model allowlist and defaults.
 * See https://platform.openai.com/docs/api-reference/images/createEdit
 */

export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5";

/** Curated options for settings UI; custom snapshot IDs validated by regex below. */
export const OPENAI_IMAGE_MODEL_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "gpt-image-1.5", label: "GPT Image 1.5" },
  { id: "gpt-image-1.5-2025-12-16", label: "GPT Image 1.5 (snapshot 2025-12-16)" },
  { id: "gpt-image-1", label: "GPT Image 1" },
  { id: "gpt-image-1-mini", label: "GPT Image 1 mini" }
];

// gpt-image-1 | gpt-image-1-mini | gpt-image-1.5 | gpt-image-1.5-YYYY-MM-DD
const OPENAI_IMAGE_MODEL_RE = /^gpt-image-1(\.5(-\d{4}-\d{2}-\d{2})?|-mini)?$/;

export function isValidOpenAiImageModel(model: string): boolean {
  const t = model.trim();
  if (!t || t.length > 80) {
    return false;
  }
  return OPENAI_IMAGE_MODEL_RE.test(t);
}
