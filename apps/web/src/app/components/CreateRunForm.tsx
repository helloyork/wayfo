"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiBase } from "../../lib/api";

type BrandAssociation = {
  id: string;
  manufacturer: { id: string; name?: string | null };
};

type BrandsResponse = {
  brands: BrandAssociation[];
  cached: boolean;
  fetchedAt: string;
};

export function CreateRunForm({
  initialMarketContext,
  onMarketContextChange
}: {
  initialMarketContext?: string;
  onMarketContextChange?: (value: string) => void;
}) {
  const router = useRouter();
  const [amazonUrl, setAmazonUrl] = useState("");
  const [marketContext, setMarketContext] = useState(initialMarketContext ?? "");
  const [manufacturerId, setManufacturerId] = useState("");
  const [brands, setBrands] = useState<BrandAssociation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async (mc: string) => {
    setBrandsLoading(true);
    setBrandsError(null);
    try {
      const params = new URLSearchParams();
      if (mc) {
        params.set("marketContext", mc);
      }
      const url = `${apiBase}/api/wayfair/brands${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to fetch brands");
      }
      const data = (await res.json()) as BrandsResponse;
      setBrands(data.brands);
      if (data.brands.length > 0 && !manufacturerId) {
        setManufacturerId(data.brands[0].manufacturer?.id ?? "");
      }
    } catch (err) {
      setBrandsError(err instanceof Error ? err.message : "Failed to fetch brands");
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, [manufacturerId]);

  useEffect(() => {
    fetchBrands(marketContext);
  }, []);

  const handleMarketContextChange = (value: string) => {
    setMarketContext(value);
    onMarketContextChange?.(value);
    fetchBrands(value);
  };

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
          marketContext: marketContext || undefined,
          manufacturerId: manufacturerId || undefined
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
        <label className="stack">
          <span>Amazon URL</span>
          <input
            className="input"
            value={amazonUrl}
            onChange={(event) => setAmazonUrl(event.target.value)}
            placeholder="https://www.amazon.com/..."
            autoComplete="off"
            required
          />
        </label>
        <label className="stack">
          <span>Market Context</span>
          <input
            className="input"
            value={marketContext}
            onChange={(event) => handleMarketContextChange(event.target.value)}
            placeholder='{"locale":"en-US","country":"UNITED_STATES","brand":"WAYFAIR"}'
            autoComplete="off"
          />
        </label>
        <label className="stack">
          <span>Brand / Manufacturer</span>
          {brandsLoading ? (
            <div className="muted">Loading brands...</div>
          ) : brandsError ? (
            <div className="muted">{brandsError}</div>
          ) : (
            <select
              className="input"
              value={manufacturerId}
              onChange={(event) => setManufacturerId(event.target.value)}
            >
              <option value="">-- Select Brand --</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.manufacturer?.id ?? ""}>
                  {brand.manufacturer?.name ?? brand.manufacturer?.id ?? brand.id}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      {error ? <div className="muted">{error}</div> : null}
      <button className="btn" type="submit" disabled={loading || !manufacturerId}>
        {loading ? "创建中..." : "创建 Run"}
      </button>
    </form>
  );
}
