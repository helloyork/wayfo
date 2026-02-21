import { ProductCard } from "./ProductCard";

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
};

export function ProductGrid({
  products
}: {
  products: ProductSummary[];
}) {
  if (products.length === 0) {
    return <div className="empty">暂无产品数据</div>;
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.asin} product={product} />
      ))}
    </div>
  );
}
