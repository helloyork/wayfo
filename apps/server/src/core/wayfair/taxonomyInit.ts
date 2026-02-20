import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { dataRoot, ensureDir } from "../paths";
import { log } from "../logger";
import { getTaxonomyCacheMaxAgeDays, getTaxonomyPageSize } from "../config";
import { wayfairGraphqlRequest, type WayfairEnv } from "../../connectors/wayfair";

export type MarketContext = {
  locale: string;
  country: string;
  brand: string;
};

export type TaxonomyInitPhase =
  | "FETCHING_TAXONOMY"
  | "WRITING_DOCUMENTS"
  | "BUILDING_BM25"
  | "FINALIZING";

export type TaxonomyInitProgress = {
  phase: TaxonomyInitPhase;
  message: string;
  page?: number;
  totalPages?: number;
};

type WayfairCredentials = {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
};

type TaxonomyCategory = {
  taxonomyCategoryId: string;
  name: string;
};

type TaxonomyPageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  totalPages: number;
};

type TaxonomyCategoriesResponse = {
  taxonomyCategories: {
    pageInfo: TaxonomyPageInfo;
    taxonomyCategories: TaxonomyCategory[];
  };
};

type TaxonomyDocument = {
  id: string;
  classId: string;
  name: string;
  path: string | null;
  description: string | null;
  text: string;
};

type TaxonomyCacheMeta = {
  env: WayfairEnv;
  poolId: string;
  marketContext: MarketContext;
  marketContextHash: string;
  schemaVersion: string;
  initializedAt: string;
  expiresAt: string;
  activeVersion: string;
  previousVersion?: string;
  refreshing?: boolean;
  lastRefreshAttemptAt?: string;
  lastRefreshError?: string;
};

type TaxonomyCacheResult = {
  status: "fresh" | "stale" | "rebuilt";
  meta: TaxonomyCacheMeta;
  versionDir: string;
};

const taxonomySchemaVersion = "v1";

const taxonomyQuery = `
query taxonomyCategories($marketContext: MarketContextInput!, $paginationOptions: PaginationOptions) {
  taxonomyCategories(marketContext: $marketContext, paginationOptions: $paginationOptions) {
    pageInfo { page pageSize hasNextPage totalPages }
    taxonomyCategories { taxonomyCategoryId name }
  }
}
`;

export function parseMarketContext(input?: string): MarketContext | null {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<MarketContext>;
    if (isMarketContext(parsed)) {
      return {
        locale: String(parsed.locale),
        country: String(parsed.country),
        brand: String(parsed.brand)
      };
    }
  } catch {
    // Ignore JSON parse error and try fallback format.
  }
  const parts = trimmed.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length === 3) {
    return { locale: parts[0], country: parts[1], brand: parts[2] };
  }
  return null;
}

function isMarketContext(input: Partial<MarketContext> | null | undefined): input is MarketContext {
  return Boolean(input?.locale && input?.country && input?.brand);
}

function marketContextHash(marketContext: MarketContext) {
  return createHash("sha256").update(JSON.stringify(marketContext)).digest("hex");
}

export function getMarketContextHash(marketContext: MarketContext) {
  return marketContextHash(marketContext);
}

export function getTaxonomyCacheRootDir(input: {
  env: WayfairEnv;
  poolId: string;
  marketContext: MarketContext;
}) {
  return cacheRoot(input.env, input.poolId, marketContextHash(input.marketContext));
}

function cacheRoot(env: WayfairEnv, poolId: string, contextHash: string) {
  return path.join(dataRoot, "cache", "wayfair", "taxonomy", env, poolId, contextHash);
}

function metaPath(root: string) {
  return path.join(root, "meta.json");
}

function versionsRoot(root: string) {
  return path.join(root, "versions");
}

function versionDir(root: string, version: string) {
  return path.join(versionsRoot(root), version);
}

function readMeta(root: string): TaxonomyCacheMeta | null {
  const filePath = metaPath(root);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TaxonomyCacheMeta;
}

export function getTaxonomyCacheMeta(input: {
  poolId: string;
  marketContext: MarketContext;
  env: WayfairEnv;
}) {
  const root = cacheRoot(input.env, input.poolId, marketContextHash(input.marketContext));
  return readMeta(root);
}

function writeMeta(root: string, meta: TaxonomyCacheMeta) {
  ensureDir(root);
  fs.writeFileSync(metaPath(root), JSON.stringify(meta, null, 2));
}

function isExpired(meta: TaxonomyCacheMeta) {
  const ts = new Date(meta.expiresAt).getTime();
  if (!Number.isFinite(ts)) {
    return true;
  }
  return Date.now() > ts;
}

function resolveActiveVersionDir(root: string, meta: TaxonomyCacheMeta) {
  const dir = versionDir(root, meta.activeVersion);
  return fs.existsSync(dir) ? dir : null;
}

function ensureVersionDir(root: string, version: string) {
  const dir = versionDir(root, version);
  ensureDir(dir);
  return dir;
}

function taxonomyArtifactsPath(dir: string) {
  return {
    taxonomyCategories: path.join(dir, "taxonomyCategories.json"),
    documents: path.join(dir, "documents.jsonl"),
    bm25: path.join(dir, "bm25", "index.json")
  };
}

export function isTaxonomyCacheVersionReady(versionDirPath: string) {
  const artifacts = taxonomyArtifactsPath(versionDirPath);
  return (
    fs.existsSync(artifacts.taxonomyCategories) &&
    fs.existsSync(artifacts.documents) &&
    fs.existsSync(artifacts.bm25)
  );
}

function buildDocuments(categories: TaxonomyCategory[]): TaxonomyDocument[] {
  return categories.map((category) => {
    const classId = String(category.taxonomyCategoryId);
    const text = `${category.name} (classId: ${classId})`;
    return {
      id: classId,
      classId,
      name: category.name,
      path: null,
      description: null,
      text
    };
  });
}

function writeDocumentsJsonl(filePath: string, docs: TaxonomyDocument[]) {
  ensureDir(path.dirname(filePath));
  const lines = docs.map((doc) => JSON.stringify(doc));
  fs.writeFileSync(filePath, lines.join("\n"));
}

function tokenize(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function buildBm25Index(docs: TaxonomyDocument[]) {
  const k1 = 1.5;
  const b = 0.75;
  let totalLength = 0;
  const docFreq: Record<string, number> = {};
  const entries = docs.map((doc) => {
    const tokens = tokenize(doc.text);
    const termFreq: Record<string, number> = {};
    tokens.forEach((token) => {
      termFreq[token] = (termFreq[token] ?? 0) + 1;
    });
    totalLength += tokens.length;
    Object.keys(termFreq).forEach((token) => {
      docFreq[token] = (docFreq[token] ?? 0) + 1;
    });
    return {
      id: doc.id,
      classId: doc.classId,
      name: doc.name,
      length: tokens.length,
      termFreq
    };
  });
  const avgDocLength = entries.length > 0 ? totalLength / entries.length : 0;
  return {
    version: taxonomySchemaVersion,
    k1,
    b,
    avgDocLength,
    docCount: entries.length,
    docFreq,
    documents: entries
  };
}

async function fetchTaxonomyCategories(input: {
  marketContext: MarketContext;
  credentials: WayfairCredentials;
  onProgress?: (progress: TaxonomyInitProgress) => void;
}) {
  const pageSize = getTaxonomyPageSize();
  let page = 1;
  const all: TaxonomyCategory[] = [];
  while (true) {
    const response = await wayfairGraphqlRequest<TaxonomyCategoriesResponse>({
      env: input.credentials.env,
      clientId: input.credentials.clientId,
      clientSecret: input.credentials.clientSecret,
      audience: input.credentials.audience,
      api: "product-catalog-api",
      query: taxonomyQuery,
      variables: {
        marketContext: input.marketContext,
        paginationOptions: { page, pageSize }
      }
    });
    const batch = response.taxonomyCategories.taxonomyCategories;
    all.push(...batch);
    const pageInfo = response.taxonomyCategories.pageInfo;
    input.onProgress?.({
      phase: "FETCHING_TAXONOMY",
      message: `拉取 taxonomyCategories: 第 ${pageInfo.page}/${pageInfo.totalPages} 页`,
      page: pageInfo.page,
      totalPages: pageInfo.totalPages
    });
    if (!pageInfo.hasNextPage) {
      break;
    }
    page = pageInfo.page + 1;
  }
  return all;
}

async function buildTaxonomyVersion(input: {
  root: string;
  version: string;
  marketContext: MarketContext;
  credentials: WayfairCredentials;
  onProgress?: (progress: TaxonomyInitProgress) => void;
}) {
  const versionRoot = ensureVersionDir(input.root, input.version);
  const artifacts = taxonomyArtifactsPath(versionRoot);
  input.onProgress?.({
    phase: "FETCHING_TAXONOMY",
    message: "开始拉取 taxonomyCategories..."
  });
  const categories = await fetchTaxonomyCategories({
    marketContext: input.marketContext,
    credentials: input.credentials,
    onProgress: input.onProgress
  });
  fs.writeFileSync(artifacts.taxonomyCategories, JSON.stringify(categories, null, 2));

  input.onProgress?.({
    phase: "WRITING_DOCUMENTS",
    message: "构建 documents.jsonl..."
  });
  const documents = buildDocuments(categories);
  writeDocumentsJsonl(artifacts.documents, documents);

  input.onProgress?.({
    phase: "BUILDING_BM25",
    message: "构建 BM25 索引..."
  });
  const bm25 = buildBm25Index(documents);
  ensureDir(path.dirname(artifacts.bm25));
  fs.writeFileSync(artifacts.bm25, JSON.stringify(bm25, null, 2));
}

function resolveExpiry(maxAgeDays: number) {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return new Date(now + maxAgeMs).toISOString();
}

export async function ensureTaxonomyCache(input: {
  poolId: string;
  marketContext: MarketContext;
  credentials: WayfairCredentials;
}): Promise<TaxonomyCacheResult> {
  const contextHash = marketContextHash(input.marketContext);
  const root = cacheRoot(input.credentials.env, input.poolId, contextHash);
  const maxAgeDays = getTaxonomyCacheMaxAgeDays();
  const existing = readMeta(root);
  const existingVersionDir = existing ? resolveActiveVersionDir(root, existing) : null;
  if (existing && existingVersionDir) {
    if (!isExpired(existing)) {
      return {
        status: "fresh",
        meta: existing,
        versionDir: existingVersionDir
      };
    }
    if (existing.refreshing) {
      return {
        status: "stale",
        meta: existing,
        versionDir: existingVersionDir
      };
    }
    const refreshMeta: TaxonomyCacheMeta = {
      ...existing,
      refreshing: true,
      lastRefreshAttemptAt: new Date().toISOString(),
      lastRefreshError: undefined
    };
    writeMeta(root, refreshMeta);
    void refreshTaxonomyCache({
      root,
      poolId: input.poolId,
      marketContext: input.marketContext,
      credentials: input.credentials,
      previousVersion: existing.activeVersion,
      maxAgeDays
    }).catch((error) => {
      const failed = readMeta(root);
      if (failed) {
        writeMeta(root, {
          ...failed,
          refreshing: false,
          lastRefreshError: error instanceof Error ? error.message : String(error)
        });
      }
      log({
        level: "warn",
        message: "Taxonomy refresh failed",
        err: error
      });
    });
    return {
      status: "stale",
      meta: existing,
      versionDir: existingVersionDir
    };
  }

  const version = `v-${Date.now()}`;
  await buildTaxonomyVersion({
    root,
    version,
    marketContext: input.marketContext,
    credentials: input.credentials
  });
  const now = new Date().toISOString();
  const meta: TaxonomyCacheMeta = {
    env: input.credentials.env,
    poolId: input.poolId,
    marketContext: input.marketContext,
    marketContextHash: contextHash,
    schemaVersion: taxonomySchemaVersion,
    initializedAt: now,
    expiresAt: resolveExpiry(maxAgeDays),
    activeVersion: version
  };
  writeMeta(root, meta);
  return {
    status: "rebuilt",
    meta,
    versionDir: versionDir(root, version)
  };
}

export async function initializeTaxonomyCacheNow(input: {
  poolId: string;
  marketContext: MarketContext;
  credentials: WayfairCredentials;
  onProgress?: (progress: TaxonomyInitProgress) => void;
}) {
  const contextHash = marketContextHash(input.marketContext);
  const root = cacheRoot(input.credentials.env, input.poolId, contextHash);
  const maxAgeDays = getTaxonomyCacheMaxAgeDays();
  const existing = readMeta(root);

  const version = `v-${Date.now()}`;
  await buildTaxonomyVersion({
    root,
    version,
    marketContext: input.marketContext,
    credentials: input.credentials,
    onProgress: input.onProgress
  });

  input.onProgress?.({
    phase: "FINALIZING",
    message: "写入 meta 并切换版本..."
  });
  const now = new Date().toISOString();
  const meta: TaxonomyCacheMeta = {
    env: input.credentials.env,
    poolId: input.poolId,
    marketContext: input.marketContext,
    marketContextHash: contextHash,
    schemaVersion: taxonomySchemaVersion,
    initializedAt: now,
    expiresAt: resolveExpiry(maxAgeDays),
    activeVersion: version,
    previousVersion: existing?.activeVersion
  };
  writeMeta(root, meta);
  return {
    meta,
    versionDir: versionDir(root, version)
  };
}

async function refreshTaxonomyCache(input: {
  root: string;
  poolId: string;
  marketContext: MarketContext;
  credentials: WayfairCredentials;
  previousVersion: string;
  maxAgeDays: number;
}) {
  const version = `v-${Date.now()}`;
  await buildTaxonomyVersion({
    root: input.root,
    version,
    marketContext: input.marketContext,
    credentials: input.credentials,
  });
  const now = new Date().toISOString();
  const nextMeta: TaxonomyCacheMeta = {
    env: input.credentials.env,
    poolId: input.poolId,
    marketContext: input.marketContext,
    marketContextHash: marketContextHash(input.marketContext),
    schemaVersion: taxonomySchemaVersion,
    initializedAt: now,
    expiresAt: resolveExpiry(input.maxAgeDays),
    activeVersion: version,
    previousVersion: input.previousVersion,
    refreshing: false,
    lastRefreshAttemptAt: now,
    lastRefreshError: undefined
  };
  writeMeta(input.root, nextMeta);
}
