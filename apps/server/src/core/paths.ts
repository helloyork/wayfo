import fs from "fs";
import path from "path";

export const repoRoot = process.env.WAYFO_ROOT
  ? path.resolve(process.env.WAYFO_ROOT)
  : path.resolve(process.cwd(), "../..");

export const dataRoot = path.join(repoRoot, "data");
export const runsRoot = path.join(dataRoot, "runs");

export function ensureDir(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}
