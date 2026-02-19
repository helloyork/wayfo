import fs from "fs";
import path from "path";
import { dataRoot, ensureDir } from "../core/paths";
import { getWayfairPool } from "../core/pools/registry";
import { log } from "../core/logger";

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

function normalizeCredential(value: string, mode: "trim" | "no-whitespace") {
  const trimmed = value.trim();
  if (mode === "trim") {
    return trimmed;
  }
  return trimmed.replace(/\s+/g, "");
}

function maskSecret(value: string) {
  if (!value) {
    return "";
  }
  if (value.length <= 6) {
    return "***";
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function hasWhitespace(value: string) {
  return /\s/.test(value);
}

async function safeReadBody(response: Response) {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

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
  const url = "https://sso.auth.wayfair.com/oauth/token";
  const normalized = {
    clientId: normalizeCredential(input.clientId, "no-whitespace"),
    clientSecret: normalizeCredential(input.clientSecret, "no-whitespace"),
    audience: normalizeCredential(input.audience, "trim")
  };
  const requestPayload = {
    grant_type: "client_credentials",
    client_id: normalized.clientId,
    client_secret: normalized.clientSecret,
    audience: normalized.audience
  };

  const jsonAttempt = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(requestPayload)
  });

  if (!jsonAttempt.ok) {
    const jsonBody = await safeReadBody(jsonAttempt);
    const isInvalidClient =
      typeof jsonBody === "object" &&
      jsonBody !== null &&
      (jsonBody as { error?: string }).error === "invalid_client";

    const formAttempt = isInvalidClient
      ? await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          },
          body: new URLSearchParams(requestPayload)
        })
      : null;

    if (formAttempt && formAttempt.ok) {
      const payload = (await formAttempt.json()) as {
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

    const formBody = formAttempt ? await safeReadBody(formAttempt) : null;
    const debug = {
      url,
      method: "POST",
      env: input.env,
      credentialHints: {
        clientIdLength: input.clientId.length,
        clientSecretLength: input.clientSecret.length,
        clientIdHasWhitespace: hasWhitespace(input.clientId),
        clientSecretHasWhitespace: hasWhitespace(input.clientSecret),
        clientIdNormalizedLength: normalized.clientId.length,
        clientSecretNormalizedLength: normalized.clientSecret.length,
        clientIdNormalizedHasWhitespace: hasWhitespace(normalized.clientId),
        clientSecretNormalizedHasWhitespace: hasWhitespace(normalized.clientSecret)
      },
      attempts: [
        {
          contentType: "application/json",
          body: {
            grant_type: "client_credentials",
            client_id: maskSecret(normalized.clientId),
            client_secret: "***",
            audience: normalized.audience
          },
          response: {
            status: jsonAttempt.status,
            statusText: jsonAttempt.statusText,
            body: jsonBody
          }
        },
        formAttempt
          ? {
              contentType: "application/x-www-form-urlencoded",
              body: {
                grant_type: "client_credentials",
                client_id: maskSecret(normalized.clientId),
                client_secret: "***",
                audience: normalized.audience
              },
              response: {
                status: formAttempt.status,
                statusText: formAttempt.statusText,
                body: formBody
              }
            }
          : null
      ].filter(Boolean)
    };
    log({
      level: "error",
      message: "Wayfair token request failed",
      err: debug
    });
    throw new WayfairApiError({
      code: `WAYFAIR_TOKEN_${jsonAttempt.status}`,
      message: `Wayfair token request failed: ${jsonAttempt.status}\n${JSON.stringify(debug, null, 2)}`,
      retryable: jsonAttempt.status >= 500 || jsonAttempt.status === 429
    });
  }

  const payload = (await jsonAttempt.json()) as {
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
  const normalizedClientId = normalizeCredential(input.clientId, "no-whitespace");
  const normalizedClientSecret = normalizeCredential(input.clientSecret, "no-whitespace");
  const normalizedAudience = normalizeCredential(input.audience, "trim");

  if (!normalizedClientId || !normalizedClientSecret || !normalizedAudience) {
    throw new WayfairApiError({
      code: "WAYFAIR_CREDENTIALS_INVALID",
      message: "Wayfair 凭据无效：clientId/clientSecret/audience 不能为空（已自动去除空白字符后仍为空）"
    });
  }

  const cacheKey = tokenCacheKey(input.env, normalizedClientId);
  const cached = tokenCache.get(cacheKey);
  if (cached && !isExpiringSoon(cached.expiresAt)) {
    return cached;
  }
  const disk = readTokenFromDisk(input.env);
  if (disk && disk.clientId === normalizedClientId && !isExpiringSoon(disk.expiresAt)) {
    tokenCache.set(cacheKey, disk);
    return disk;
  }

  const fresh = await fetchWayfairToken(input);
  const stored: WayfairTokenCache = { ...fresh, clientId: normalizedClientId };
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
