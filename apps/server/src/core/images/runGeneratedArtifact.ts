import fs from "fs";
import path from "path";
import { runsRoot } from "../paths";

export type RunGeneratedImageEntry = {
  type: string;
  fileName: string;
  path: string;
};

/**
 * Lists generated image API paths for a product within a run (from images/generated.json).
 */
export function listRunGeneratedImageEntries(
  runId: string,
  asin: string
): RunGeneratedImageEntry[] {
  const artifactPath = path.join(runsRoot, runId, "artifacts", "images", "generated.json");
  if (!fs.existsSync(artifactPath)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(artifactPath, "utf-8")) as {
    results?: Record<string, Array<{ generatedPath: string }>>;
  };
  const images = payload.results?.[asin] ?? [];
  return images
    .map((image) => {
      const fileName = path.basename(image.generatedPath);
      const type = path.basename(path.dirname(image.generatedPath));
      return {
        type,
        fileName,
        path: `/api/runs/${runId}/generated-images/${asin}/${type}/${encodeURIComponent(fileName)}`
      };
    })
    .filter((item) => item.fileName);
}
