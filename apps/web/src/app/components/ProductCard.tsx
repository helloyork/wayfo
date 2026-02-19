import Link from "next/link";
import { apiBase } from "../../lib/api";

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

function formatPrice(price?: ProductSummary["price"]) {
  if (!price?.current) {
    return "暂无价格";
  }
  const symbol = price.symbol ?? "";
  return `${symbol}${price.current.toFixed(2)}`;
}

export function ProductCard({
  runId,
  product
}: {
  runId: string;
  product: ProductSummary;
}) {
  const imageSrc = product.imageName
    ? `${apiBase}/api/runs/${runId}/images/${product.asin}/${encodeURIComponent(product.imageName)}`
    : product.imageUrl;

  return (
    <Link href={`/products/${product.asin}`} className="card product-card">
      {imageSrc ? (
        <img className="product-image" src={imageSrc} alt={product.title} />
      ) : (
        <div className="empty">暂无图片</div>
      )}
      <div className="product-title">{product.title}</div>
      <div className="product-price">{formatPrice(product.price)}</div>
      <div className="product-meta">
        {product.brand ? product.brand : "未提供品牌"} ·{" "}
        {product.availability?.isAvailable ? "有货" : "无货"}
      </div>
    </Link>
  );
}
