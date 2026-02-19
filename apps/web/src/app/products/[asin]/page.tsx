import Link from "next/link";
import { fetchJson } from "../../../lib/api";
import { ProductDetail } from "../../components/ProductDetail";

export const dynamic = "force-dynamic";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

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

type ProductResponse = {
  product: ProductSnapshot;
  images?: ImageIndex;
};

export default async function ProductDetailPage({
  params
}: {
  params: { asin: string };
}) {
  const runs = await fetchJson<Run[]>("/api/runs");
  const latestRun = runs[0];

  if (!latestRun) {
    return <div className="empty">暂无 Run 数据</div>;
  }

  const detail = await fetchJson<ProductResponse>(
    `/api/runs/${latestRun.id}/products/${params.asin}`
  );

  return (
    <div className="stack">
      <div className="row">
        <Link href="/products">返回产品列表</Link>
        <div className="muted">Run {latestRun.id}</div>
      </div>
      <ProductDetail runId={latestRun.id} product={detail.product} images={detail.images} />
    </div>
  );
}
