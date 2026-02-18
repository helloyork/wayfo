export const apiBase =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export async function fetchJson<T>(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
