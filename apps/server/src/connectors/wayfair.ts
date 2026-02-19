import fs from "fs";
import path from "path";
import { dataRoot, ensureDir } from "../core/paths";
import { getWayfairPool } from "../core/pools/registry";

export type WayfairEnv = "sandbox" | "prod";

export type WayfairAuthToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
};

export class WayfairApiError extends Error {
  code: string;
  retryable: boolean;
  constructor(input: { code: string; message: string; retryable?: boolean }) {
    super(input.message);
    this.code = input.code;
    this.retryable = input.retryable ?? false;
  }
}

type WayfairTokenCache = WayfairAuthToken & { clientId: string };

const tokenCache = new Map<string, WayfairTokenCache>();

function tokenCacheKey(env: WayfairEnv, clientId: string) {
  return `${env}:${clientId}`;
}

function tokenCachePath(env: WayfairEnv) {
  return path.join(dataRoot, "wayfair", `token-${env}.json`);
}

function readTokenFromDisk(env: WayfairEnv): WayfairTokenCache | null {
  const filePath = tokenCachePath(env);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as WayfairTokenCache;
}

function writeTokenToDisk(env: WayfairEnv, token: WayfairTokenCache) {
  ensureDir(path.join(dataRoot, "wayfair"));
  fs.writeFileSync(tokenCachePath(env), JSON.stringify(token, null, 2));
}

function isExpiringSoon(expiresAt: string, bufferMinutes = 10) {
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) {
    return true;
  }
  const bufferMs = bufferMinutes * 60 * 1000;
  return Date.now() + bufferMs >= ts;
}

async function fetchWayfairToken(input: {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
}): Promise<WayfairAuthToken> {
  const response = await fetch("https://sso.auth.wayfair.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      audience: input.audience
    })
  });

  if (!response.ok) {
    throw new WayfairApiError({
      code: `WAYFAIR_TOKEN_${response.status}`,
      message: `Wayfair token request failed: ${response.status}`,
      retryable: response.status >= 500 || response.status === 429
    });
  }

  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  if (!payload.access_token || !payload.token_type || !payload.expires_in) {
    throw new WayfairApiError({
      code: "WAYFAIR_TOKEN_INVALID",
      message: "Wayfair token response missing fields"
    });
  }

  const expiresAt = new Date(Date.now() + payload.expires_in * 1000).toISOString();
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    expiresAt
  };
}

export async function getWayfairAccessToken(input: {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
}): Promise<WayfairAuthToken> {
  const cacheKey = tokenCacheKey(input.env, input.clientId);
  const cached = tokenCache.get(cacheKey);
  if (cached && !isExpiringSoon(cached.expiresAt)) {
    return cached;
  }
  const disk = readTokenFromDisk(input.env);
  if (disk && disk.clientId === input.clientId && !isExpiringSoon(disk.expiresAt)) {
    tokenCache.set(cacheKey, disk);
    return disk;
  }

  const fresh = await fetchWayfairToken(input);
  const stored: WayfairTokenCache = { ...fresh, clientId: input.clientId };
  tokenCache.set(cacheKey, stored);
  writeTokenToDisk(input.env, stored);
  return stored;
}

export async function validateWayfairCredentials(input: {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
}) {
  return getWayfairAccessToken(input);
}

export function getWayfairGraphqlUrl(env: WayfairEnv, api: string) {
  const prefix = env === "sandbox" ? "sandbox/" : "";
  return `https://api.wayfair.io/${prefix}v1/${api}/graphql`;
}

export async function wayfairGraphqlRequest<T>(input: {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
  api: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const pool = getWayfairPool();
  const results = await pool.run([input], async (entry) => {
    const token = await getWayfairAccessToken({
      env: entry.env,
      clientId: entry.clientId,
      clientSecret: entry.clientSecret,
      audience: entry.audience
    });

    const response = await fetch(getWayfairGraphqlUrl(entry.env, entry.api), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.accessToken}`
      },
      body: JSON.stringify({
        query: entry.query,
        variables: entry.variables ?? {}
      })
    });

    if (!response.ok) {
      throw new WayfairApiError({
        code: `WAYFAIR_HTTP_${response.status}`,
        message: `Wayfair GraphQL request failed: ${response.status}`,
        retryable: response.status >= 500 || response.status === 429
      });
    }

    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string; extensions?: { code?: string } }>;
    };
    if (payload.errors && payload.errors.length > 0) {
      const first = payload.errors[0];
      throw new WayfairApiError({
        code: first.extensions?.code ?? "WAYFAIR_GRAPHQL_ERROR",
        message: first.message ?? "Wayfair GraphQL error"
      });
    }
    if (!payload.data) {
      throw new WayfairApiError({
        code: "WAYFAIR_GRAPHQL_EMPTY",
        message: "Wayfair GraphQL response missing data"
      });
    }
    return payload.data;
  });
  return results[0];
}
