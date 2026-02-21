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
    <div className="stack">
      <div className="row">
        <Link href="/products">返回产品列表</Link>
        <div className="muted">
          来源 Run: {detail.runId} · 状态: {detail.runStatus}
        </div>
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
