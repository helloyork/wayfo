import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { ProductGrid } from "../components/ProductGrid";

type Run = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

type ProductSummary = {
  asin: string;
  title: string;
  brand?: string;
  price?: {
    currency?: string;
    symbol?: string;
    current?: number;
    before?: number;
    discount?: string;
  };
  availability?: {
    isAvailable: boolean;
  };
  imageName?: string;
  imageUrl?: string;
};

export default async function ProductsPage() {
  const runs = await fetchJson<Run[]>("/api/runs");
  const latestRun = runs[0];

  if (!latestRun) {
    return <div className="empty">暂无 Run 数据</div>;
  }

  const products = await fetchJson<ProductSummary[]>(
    `/api/runs/${latestRun.id}/products`
  );

  return (
    <div className="stack">
      <div className="row">
        <div className="page-header">
          <h2>产品预览</h2>
          <div className="muted">
            最新 Run: {latestRun.id} · 状态: {latestRun.status}
          </div>
        </div>
        <Link className="muted" href={`/runs/${latestRun.id}`}>
          查看 Run 详情
        </Link>
      </div>

      <ProductGrid runId={latestRun.id} products={products} />
    </div>
  );
}
