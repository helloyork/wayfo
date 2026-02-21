import Link from "next/link";
import { fetchJson } from "../../lib/api";
import { ProductGrid } from "../components/ProductGrid";

export const dynamic = "force-dynamic";

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
  runId: string;
  runStatus: string;
  runCreatedAt: string;
};

export default async function ProductsPage() {
  const products = await fetchJson<ProductSummary[]>("/api/products");

  return (
    <div className="stack">
      <div className="row">
        <div className="page-header">
          <h2>产品总览</h2>
          <div className="muted">按 ASIN 汇总展示全部产品</div>
        </div>
        <Link className="muted" href="/runs">
          查看 Runs
        </Link>
      </div>

      <ProductGrid products={products} />
    </div>
  );
}
