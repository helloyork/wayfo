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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">产品总览</h2>
          <p className="text-sm text-muted-foreground">
            按 ASIN 汇总；关联批次请在卡片或详情中跳转
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            主界面
          </Link>
          <Link
            href="/runs"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            全部批次
          </Link>
        </div>
      </div>

      <ProductGrid products={products} />
    </div>
  );
}
