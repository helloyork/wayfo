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
    <Card className="flex h-full flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/products/${product.asin}`} className="block flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
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
      </Link>
      <div className="border-t border-border/80 px-4 py-2.5">
        <Link
          href={`/runs/${product.runId}`}
          title={product.runId}
          className="inline-block max-w-full truncate font-mono text-xs font-medium text-primary hover:underline"
        >
          来源批次 · {product.runId}
        </Link>
      </div>
    </Card>
  );
}
