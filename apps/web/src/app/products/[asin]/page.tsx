import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { ProductDetail } from "../../components/ProductDetail";

export const dynamic = "force-dynamic";

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

type ProductResponse = {
  runId: string;
  runStatus: string;
  runCreatedAt: string;
  product: ProductSnapshot;
  images?: ImageIndex;
  generatedImages: GeneratedImage[];
};

export default async function ProductDetailPage({
  params
}: {
  params: { asin: string };
}) {
  const detail = await fetchJson<ProductResponse>(`/api/products/${params.asin}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← 产品总览
          </Link>
          <Link
            href={`/runs/${detail.runId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            来源批次 · {detail.runId}
          </Link>
        </div>
        <span className="text-sm text-muted-foreground">
          批次状态: {detail.runStatus} · 创建于 {detail.runCreatedAt}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        说明：列表按 ASIN 展示；若多个批次处理同一 ASIN，详情页显示其中一条关联记录，完整列表见产品总览与批次页。
      </p>
      <ProductDetail
        runId={detail.runId}
        product={detail.product}
        images={detail.images}
        generatedImages={detail.generatedImages}
      />
    </div>
  );
}
