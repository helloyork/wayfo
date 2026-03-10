import Link from "next/link";
import { apiBase } from "../../lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

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

function formatPrice(price?: ProductSummary["price"]) {
  if (!price?.current) {
    return "暂无价格";
  }
  const symbol = price.symbol ?? "";
  return `${symbol}${price.current.toFixed(2)}`;
}

export function ProductCard({ product }: { product: ProductSummary }) {
  const imageSrc = product.imageName
    ? `${apiBase}/api/runs/${product.runId}/images/${product.asin}/${encodeURIComponent(product.imageName)}`
    : product.imageUrl;

  return (
    <Link href={`/products/${product.asin}`}>
      <Card className="overflow-hidden shadow-sm transition-shadow hover:shadow">
        <CardHeader className="p-0">
          <div className="aspect-square w-full overflow-hidden bg-muted/50">
            {imageSrc ? (
              <img
                className="h-full w-full object-contain p-4"
                src={imageSrc}
                alt={product.title}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                暂无图片
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-4">
          <p className="line-clamp-2 font-medium">{product.title}</p>
          <p className="text-lg font-bold">{formatPrice(product.price)}</p>
          <CardDescription>
            {product.brand ? product.brand : "未提供品牌"} ·{" "}
            {product.availability?.isAvailable ? "有货" : "无货"}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
