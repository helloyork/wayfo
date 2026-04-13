"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { apiBase } from "../../lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProductSnapshot = {
  asin: string;
  title: string;
  brand?: string;
  canonicalUrl: string;
  availability: { isAvailable: boolean };
  price?: {
    currency?: string;
    symbol?: string;
    current?: number;
    before?: number;
    discount?: string;
  };
  bullets?: string[];
  productInformation: {
    features: Record<string, string>;
    specs: Record<string, string>;
  };
  images: {
    primary?: string;
    all: string[];
    description: string[];
    videos: string[];
    primaryVideo?: string;
  };
};

type ImageIndex = {
  items: Array<{
    url: string;
    fileName: string;
  }>;
};

type GeneratedImage = {
  type: string;
  path: string;
  fileName: string;
};

function formatPrice(price?: ProductSnapshot["price"]) {
  if (!price?.current) {
    return "暂无价格";
  }
  const symbol = price.symbol ?? "";
  return `${symbol}${price.current.toFixed(2)}`;
}

function buildImageSources(
  runId: string,
  asin: string,
  snapshot: ProductSnapshot,
  index?: ImageIndex
) {
  if (index?.items?.length) {
    return index.items.map(
      (item) =>
        `${apiBase}/api/runs/${runId}/images/${asin}/${encodeURIComponent(item.fileName)}`
    );
  }
  return snapshot.images.all.length > 0
    ? snapshot.images.all
    : snapshot.images.primary
      ? [snapshot.images.primary]
      : [];
}

export function ProductDetail({
  runId,
  product,
  images,
  generatedImages,
}: {
  runId: string;
  product: ProductSnapshot;
  images?: ImageIndex;
  generatedImages?: GeneratedImage[];
}) {
  const imageSources = useMemo(
    () => buildImageSources(runId, product.asin, product, images),
    [images, product, runId]
  );
  const generatedSources = useMemo(
    () =>
      (generatedImages ?? []).map((img) => ({
        ...img,
        url: `${apiBase}${img.path}`,
      })),
    [generatedImages]
  );
  const initialImage = imageSources[0] ?? generatedSources[0]?.url ?? "";
  const [activeImage, setActiveImage] = useState(initialImage);
  const featureEntries = Object.entries(
    product.productInformation.features ?? {}
  );
  const specEntries = Object.entries(product.productInformation.specs ?? {});
  const hasGenerated = generatedSources.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 p-4">
              {activeImage ? (
                <img
                  className="aspect-square w-full object-contain rounded-lg border border-border bg-muted/50 p-4"
                  src={activeImage}
                  alt={product.title}
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-sm text-muted-foreground">
                  暂无图片
                </div>
              )}
              {imageSources.length > 1 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                  {imageSources.slice(0, 9).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActiveImage(src)}
                      className="overflow-hidden rounded-md border border-border bg-muted/50 p-1 transition-colors hover:border-primary/50"
                    >
                      <img
                        className="aspect-square w-full object-cover"
                        src={src}
                        alt={product.title}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{product.title}</CardTitle>
            <CardDescription>ASIN: {product.asin}</CardDescription>
            <CardDescription>
              品牌: {product.brand ? product.brand : "未提供品牌"}
            </CardDescription>
            <p className="text-lg font-bold">{formatPrice(product.price)}</p>
            <CardDescription>
              {product.availability.isAvailable ? "有货" : "无货"}
              {product.price?.before ? ` · 原价 ${product.price.before}` : ""}
              {product.price?.discount ? ` · ${product.price.discount}` : ""}
            </CardDescription>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <a
                className="text-sm font-medium text-primary hover:underline"
                href={product.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看 Amazon 页面
              </a>
              <Link
                href={`/runs/${runId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                查看来源批次
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 font-semibold">关于此商品</h3>
              {product.bullets && product.bullets.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {product.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  暂无卖点描述
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>AI 生成图片</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasGenerated ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              暂无生成图片
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
              {generatedSources.map((img) => (
                <button
                  key={`${img.type}-${img.fileName}`}
                  type="button"
                  onClick={() => setActiveImage(img.url)}
                  className="overflow-hidden rounded-md border border-border bg-muted/50 p-1 transition-colors hover:border-primary/50"
                >
                  <img
                    className="aspect-square w-full object-cover"
                    src={img.url}
                    alt={`${product.title}-${img.type}`}
                  />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>功能亮点</CardTitle>
          </CardHeader>
          <CardContent>
            {featureEntries.length > 0 ? (
              <div className="flex flex-col gap-3">
                {featureEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4"
                  >
                    <span className="font-medium">{key}</span>
                    <span className="text-sm text-muted-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                暂无功能信息
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>规格参数</CardTitle>
          </CardHeader>
          <CardContent>
            {specEntries.length > 0 ? (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {specEntries.map(([key, value]) => (
                    <tr
                      key={key}
                      className="border-b border-border last:border-0"
                    >
                      <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                        {key}
                      </th>
                      <td className="py-3">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                暂无规格参数
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
