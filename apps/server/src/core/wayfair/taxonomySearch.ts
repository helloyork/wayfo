import fs from "fs";
import path from "path";

export type TaxonomyDocument = {
  id: string;
  classId: string;
  name: string;
  path?: string | null;
  description?: string | null;
  text: string;
};

export type Bm25Index = {
  version: string;
  k1: number;
  b: number;
  avgDocLength: number;
  docCount: number;
  docFreq: Record<string, number>;
  documents: Array<{
    id: string;
    classId: string;
    name: string;
    length: number;
    termFreq: Record<string, number>;
  }>;
};

export type Bm25Candidate = {
  classId: string;
  name: string;
  score: number;
  tokenHits: string[];
};

export function loadTaxonomyDocuments(versionDir: string) {
  const filePath = path.join(versionDir, "documents.jsonl");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TaxonomyDocument);
}

export function loadBm25Index(versionDir: string) {
  const filePath = path.join(versionDir, "bm25", "index.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Bm25Index;
}

export function tokenize(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function bm25Search(index: Bm25Index, queryTokens: string[], limit: number): Bm25Candidate[] {
  if (!queryTokens.length || index.docCount === 0) {
    return [];
  }
  const scores: Bm25Candidate[] = [];
  const uniqueTokens = Array.from(new Set(queryTokens));
  const avgLen = index.avgDocLength || 1;
  const k1 = index.k1;
  const b = index.b;

  index.documents.forEach((doc) => {
    let score = 0;
    const tokenHits: string[] = [];
    uniqueTokens.forEach((token) => {
      const df = index.docFreq[token] ?? 0;
      if (df === 0) {
        return;
      }
      const tf = doc.termFreq[token] ?? 0;
      if (tf === 0) {
        return;
      }
      tokenHits.push(token);
      const idf = Math.log(1 + (index.docCount - df + 0.5) / (df + 0.5));
      const denom = tf + k1 * (1 - b + b * (doc.length / avgLen));
      score += idf * ((tf * (k1 + 1)) / denom);
    });
    if (score > 0) {
      scores.push({
        classId: doc.classId,
        name: doc.name,
        score,
        tokenHits
      });
    }
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}
