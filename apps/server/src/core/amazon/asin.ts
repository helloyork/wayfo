const asinRegex = /(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i;
const rawAsinRegex = /^[A-Z0-9]{10}$/i;

export function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (rawAsinRegex.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(asinRegex);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  } catch {
    const match = trimmed.match(asinRegex);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

export function normalizeAmazonDomain(input: string): string {
  try {
    const url = new URL(input.trim());
    return url.hostname.toLowerCase();
  } catch {
    return "www.amazon.com";
  }
}

export function buildCanonicalUrl(domain: string, asin: string) {
  return `https://${domain}/dp/${asin}`;
}
