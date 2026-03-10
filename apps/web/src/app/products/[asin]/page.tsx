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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/products"
          className="text-sm text-primary hover:underline"
        >
          返回产品列表
        </Link>
        <span className="text-sm text-muted-foreground">
          来源 Run: {detail.runId} · 状态: {detail.runStatus}
        </span>
      </div>
      <ProductDetail
        runId={detail.runId}
        product={detail.product}
        images={detail.images}
        generatedImages={detail.generatedImages}
      />
    </div>
  );
}
