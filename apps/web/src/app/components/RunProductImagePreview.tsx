"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiBase } from "../../lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ScrapedImageItem = {
  url: string;
  fileName: string;
};

type GeneratedImageItem = {
  type: string;
  fileName: string;
  path: string;
};

type RunProductRow = {
  asin: string;
  title: string;
  scrapedImages: ScrapedImageItem[];
  generatedImages: GeneratedImageItem[];
  remoteImageUrls: string[];
};

function buildOriginalUrls(
  runId: string,
  asin: string,
  scraped: ScrapedImageItem[],
  remoteFallbacks: string[]
) {
  if (scraped.length > 0) {
    return scraped.map(
      (item) =>
        `${apiBase}/api/runs/${runId}/images/${asin}/${encodeURIComponent(item.fileName)}`
    );
  }
  return remoteFallbacks;
}

function ProductImageStrip({
  runId,
  row,
}: {
  runId: string;
  row: RunProductRow;
}) {
  const originalUrls = useMemo(
    () => buildOriginalUrls(runId, row.asin, row.scrapedImages, row.remoteImageUrls),
    [runId, row.asin, row.scrapedImages, row.remoteImageUrls]
  );
  const generated = useMemo(
    () =>
      row.generatedImages.map((img) => ({
        ...img,
        url: `${apiBase}${img.path}`,
      })),
    [row.generatedImages]
  );

  const [active, setActive] = useState("");

  useEffect(() => {
    setActive((prev) => {
      const all = [...originalUrls, ...generated.map((g) => g.url)];
      if (prev && all.includes(prev)) {
        return prev;
      }
      return originalUrls[0] ?? generated[0]?.url ?? "";
    });
  }, [originalUrls, generated]);

  const hasOriginals = originalUrls.length > 0;
  const hasGenerated = generated.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {row.title}
          </span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {row.asin}
          </Badge>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={`/products/${row.asin}`}>产品详情</Link>
        </Button>
      </div>
      {active ? (
        <img
          className="mx-auto aspect-square max-h-[min(360px,50vh)] w-full max-w-md object-contain rounded-lg border border-border bg-muted/50 p-3"
          src={active}
          alt={row.title}
        />
      ) : (
        <div className="flex aspect-square max-h-[min(360px,50vh)] w-full max-w-md items-center justify-center self-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          暂无图片
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          原图
        </span>
        {!hasOriginals ? (
          <p className="text-xs text-muted-foreground">暂无本地或远程原图</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
            {originalUrls.slice(0, 12).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setActive(src)}
                className="overflow-hidden rounded-md border border-border bg-muted/50 p-0.5 transition-colors hover:border-primary/50"
              >
                <img
                  className="aspect-square w-full object-cover"
                  src={src}
                  alt=""
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI 生成
        </span>
        {!hasGenerated ? (
          <p className="text-xs text-muted-foreground">生图完成后将显示在此</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
            {generated.map((img) => (
              <button
                key={`${img.type}-${img.fileName}`}
                type="button"
                onClick={() => setActive(img.url)}
                title={img.type}
                className="overflow-hidden rounded-md border border-border bg-muted/50 p-0.5 transition-colors hover:border-primary/50"
              >
                <img
                  className="aspect-square w-full object-cover"
                  src={img.url}
                  alt={`${row.title} ${img.type}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RunProductImagePreview({
  runId,
  refreshSignal = 0,
}: {
  runId: string;
  refreshSignal?: number;
}) {
  const [rows, setRows] = useState<RunProductRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const loadProducts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
      }
      try {
        const res = await fetch(`${apiBase}/api/runs/${runId}/products`, {
          cache: "no-store",
        });
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data)) {
          setRows([]);
          return;
        }
        setRows(
          data.map((item) => {
            const r = item as Record<string, unknown>;
            return {
              asin: String(r.asin ?? ""),
              title: String(r.title ?? ""),
              scrapedImages: Array.isArray(r.scrapedImages)
                ? (r.scrapedImages as ScrapedImageItem[])
                : [],
              generatedImages: Array.isArray(r.generatedImages)
                ? (r.generatedImages as GeneratedImageItem[])
                : [],
              remoteImageUrls: Array.isArray(r.remoteImageUrls)
                ? (r.remoteImageUrls as string[])
                : [],
            };
          })
        );
      } catch {
        setRows([]);
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [runId]
  );

  const scheduleReload = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void loadProducts({ silent: true });
    }, 650);
  }, [loadProducts]);

  useEffect(() => {
    setRows(null);
    void loadProducts();
  }, [runId, loadProducts]);

  useEffect(() => {
    if (refreshSignal < 1) {
      return;
    }
    scheduleReload();
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshSignal, scheduleReload]);

  if (loading && rows === null) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        正在加载产品图片…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Amazon 采集完成后，将在此显示原图与 AI 生成图预览
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">产品图片预览</h3>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => void loadProducts({ silent: true })}
        >
          刷新图片
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <ProductImageStrip key={row.asin} runId={runId} row={row} />
        ))}
      </div>
    </div>
  );
}
