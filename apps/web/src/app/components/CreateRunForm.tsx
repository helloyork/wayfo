"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiBase } from "../../lib/api";

export function CreateRunForm() {
  const router = useRouter();
  const [amazonUrl, setAmazonUrl] = useState("");
  const [marketContext, setMarketContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amazonUrl,
          marketContext: marketContext || undefined
        })
      });
      if (!res.ok) {
        throw new Error("Create run failed");
      }
      const run = (await res.json()) as { id: string };
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div className="stack">
        <label>
          Amazon URL
          <input
            className="input"
            value={amazonUrl}
            onChange={(event) => setAmazonUrl(event.target.value)}
            placeholder="https://www.amazon.com/..."
            required
          />
        </label>
        <label>
          Market Context
          <input
            className="input"
            value={marketContext}
            onChange={(event) => setMarketContext(event.target.value)}
            placeholder="US / EU / JP"
          />
        </label>
      </div>
      {error ? <div className="muted">{error}</div> : null}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "创建中..." : "创建 Run"}
      </button>
    </form>
  );
}
