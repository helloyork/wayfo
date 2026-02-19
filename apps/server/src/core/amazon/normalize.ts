import type { HasDataAmazonProductResponse, HasDataProduct } from "@wayfo/shared";
import { buildCanonicalUrl } from "./asin";

export const amazonProductSchemaVersion = "v1";

export type AmazonProductSnapshot = {
  schemaVersion: string;
  asin: string;
  canonicalUrl: string;
  title: string;
  brand?: string;
  availability: {
    isAvailable: boolean;
  };
  price?: {
    currency?: string;
    symbol?: string;
    current?: number;
    before?: number;
    discount?: string;
    priceFrom?: number;
    otherOfferQuantity?: number;
  };
  bullets?: string[];
  variants: Array<{
    asin: string;
    title?: string;
    url?: string;
    imageUrl?: string;
  }>;
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

function normalizeCurrency(symbol?: string) {
  if (!symbol) {
    return undefined;
  }
  if (symbol === "$") {
    return "USD";
  }
  return undefined;
}

function normalizeVariants(product?: HasDataProduct) {
  if (!product?.variants) {
    return [];
  }
  return product.variants
    .map((variant) => ({
      asin: variant.asin?.toUpperCase(),
      title: variant.title,
      url: variant.url,
      imageUrl: variant.imageUrl
    }))
    .filter((variant) => Boolean(variant.asin)) as Array<{
    asin: string;
    title?: string;
    url?: string;
    imageUrl?: string;
  }>;
}

function normalizeSpecs(product?: HasDataProduct) {
  const specs: Record<string, string> = {};
  for (const entry of product?.specification ?? []) {
    if (!entry?.key || !entry?.value) {
      continue;
    }
    specs[entry.key] = entry.value;
  }
  return specs;
}

function normalizeFeatures(product?: HasDataProduct) {
  const features: Record<string, string> = {};
  const source = product?.features ?? product?.primaryFeatures ?? {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.length > 0) {
      features[key] = value;
    }
  }
  return features;
}

export function normalizeHasDataProduct(
  response: HasDataAmazonProductResponse,
  domain: string
): AmazonProductSnapshot | null {
  const product = response.product;
  const asin = product?.asin?.toUpperCase();
  if (!asin || !product?.title) {
    return null;
  }

  const canonicalUrl = product.url ?? buildCanonicalUrl(domain, asin);
  const variants = normalizeVariants(product);

  return {
    schemaVersion: amazonProductSchemaVersion,
    asin,
    canonicalUrl,
    title: product.title,
    brand: product.brand,
    availability: {
      isAvailable: Boolean(product.isAvailable)
    },
    price: product.price
      ? {
          currency: normalizeCurrency(product.price.symbol),
          symbol: product.price.symbol,
          current: product.price.currentPrice,
          before: product.price.beforePrice,
          discount: product.price.discount,
          priceFrom: product.price.priceFrom,
          otherOfferQuantity: product.price.otherOfferQuantity
        }
      : undefined,
    bullets: product.featureBullets ?? [],
    variants,
    productInformation: {
      features: normalizeFeatures(product),
      specs: normalizeSpecs(product)
    },
    images: {
      primary: product.primaryImage,
      all: product.images ?? [],
      description: product.descriptionImages ?? [],
      videos: product.videos ?? [],
      primaryVideo: product.primaryVideo
    }
  };
}

export function validateAmazonSnapshot(snapshot: AmazonProductSnapshot) {
  const missing: string[] = [];
  if (!snapshot.asin) {
    missing.push("asin");
  }
  if (!snapshot.canonicalUrl) {
    missing.push("canonicalUrl");
  }
  if (!snapshot.title) {
    missing.push("title");
  }
  if (!snapshot.bullets || snapshot.bullets.length === 0) {
    missing.push("bullets");
  }
  if (!snapshot.price?.current) {
    missing.push("price.current");
  }
  if (!snapshot.images.all || snapshot.images.all.length === 0) {
    missing.push("images");
  }
  if (!snapshot.productInformation.specs || Object.keys(snapshot.productInformation.specs).length === 0) {
    missing.push("productInformation.specs");
  }
  return missing;
}
