 "use client";

import { useMemo, useState } from "react";
import { apiBase } from "../../lib/api";

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

function formatPrice(price?: ProductSnapshot["price"]) {
  if (!price?.current) {
    return "暂无价格";
  }
  const symbol = price.symbol ?? "";
  return `${symbol}${price.current.toFixed(2)}`;
}

function buildImageSources(
  runId: string,
  asin: string,
  snapshot: ProductSnapshot,
  index?: ImageIndex
) {
  if (index?.items?.length) {
    return index.items.map(
      (item) =>
        `${apiBase}/api/runs/${runId}/images/${asin}/${encodeURIComponent(item.fileName)}`
    );
  }
  return snapshot.images.all.length > 0
    ? snapshot.images.all
    : snapshot.images.primary
      ? [snapshot.images.primary]
      : [];
}

export function ProductDetail({
  runId,
  product,
  images,
  generatedImages
}: {
  runId: string;
  product: ProductSnapshot;
  images?: ImageIndex;
  generatedImages?: GeneratedImage[];
}) {
  const imageSources = useMemo(
    () => buildImageSources(runId, product.asin, product, images),
    [images, product, runId]
  );
  const generatedSources = useMemo(
    () =>
      (generatedImages ?? []).map((img) => ({
        ...img,
        url: `${apiBase}${img.path}`
      })),
    [generatedImages]
  );
  const initialImage = imageSources[0] ?? generatedSources[0]?.url ?? "";
  const [activeImage, setActiveImage] = useState(initialImage);
  const featureEntries = Object.entries(product.productInformation.features ?? {});
  const specEntries = Object.entries(product.productInformation.specs ?? {});
  const hasGenerated = generatedSources.length > 0;

  return (
    <div className="stack">
      <div className="split">
        <div className="card product-gallery">
          {activeImage ? (
            <img className="product-image" src={activeImage} alt={product.title} />
          ) : (
            <div className="empty">暂无图片</div>
          )}
          {imageSources.length > 1 ? (
            <div className="product-thumbs">
              {imageSources.slice(0, 9).map((src) => (
                <button key={src} className="thumb-button" type="button" onClick={() => setActiveImage(src)}>
                  <img className="product-thumb" src={src} alt={product.title} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="card stack">
          <div className="stack">
            <h2>{product.title}</h2>
            <div className="product-meta">ASIN: {product.asin}</div>
            <div className="product-meta">
              品牌: {product.brand ? product.brand : "未提供品牌"}
            </div>
            <div className="product-price">{formatPrice(product.price)}</div>
            <div className="product-meta">
              {product.availability.isAvailable ? "有货" : "无货"}
              {product.price?.before ? ` · 原价 ${product.price.before}` : ""}
              {product.price?.discount ? ` · ${product.price.discount}` : ""}
            </div>
            <a className="muted" href={product.canonicalUrl} target="_blank">
              查看 Amazon 页面
            </a>
          </div>
          <div className="stack">
            <strong>关于此商品</strong>
            {product.bullets && product.bullets.length > 0 ? (
              <div className="list">
                {product.bullets.map((bullet) => (
                  <div key={bullet} className="list-item">
                    {bullet}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">暂无卖点描述</div>
            )}
          </div>
        </div>
      </div>

      <div className="card stack">
        <strong>AI 生成图片</strong>
        {!hasGenerated ? (
          <div className="empty">暂无生成图片</div>
        ) : (
          <div className="product-thumbs">
            {generatedSources.map((img) => (
              <button
                key={`${img.type}-${img.fileName}`}
                className="thumb-button"
                type="button"
                onClick={() => setActiveImage(img.url)}
              >
                <img className="product-thumb" src={img.url} alt={`${product.title}-${img.type}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card stack">
          <strong>功能亮点</strong>
          {featureEntries.length > 0 ? (
            <div className="list">
              {featureEntries.map(([key, value]) => (
                <div key={key} className="list-item">
                  <strong>{key}</strong>
                  <div className="muted">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无功能信息</div>
          )}
        </div>
        <div className="card stack">
          <strong>规格参数</strong>
          {specEntries.length > 0 ? (
            <table className="table">
              <tbody>
                {specEntries.map(([key, value]) => (
                  <tr key={key}>
                    <th>{key}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">暂无规格参数</div>
          )}
        </div>
      </div>
    </div>
  );
}
