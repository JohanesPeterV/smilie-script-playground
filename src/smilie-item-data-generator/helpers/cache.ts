import * as fs from "fs";
import * as path from "path";
import type { MyGiftProductDetails, ProductMarketingContent, StockRow } from "../types";

export type CachedProduct = {
  code: string;
  stockResults?: StockRow[];
  myGiftDetails?: MyGiftProductDetails;
  marketingContent?: ProductMarketingContent;
};

export type CacheData = {
  products: Record<string, CachedProduct>;
};

const CACHE_FILE = path.join(process.cwd(), "cache.json");

export function loadCache(): CacheData {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(content) as CacheData;
      console.log(`[Cache] Loaded cache with ${Object.keys(parsed.products).length} products`);
      return parsed;
    }
  } catch (error) {
    console.warn("[Cache] Failed to load cache, starting fresh:", error);
  }

  return { products: {} };
}

export function saveCache(cache: CacheData): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    console.log(`[Cache] Saved cache with ${Object.keys(cache.products).length} products`);
  } catch (error) {
    console.error("[Cache] Failed to save cache:", error);
  }
}

export function getCachedProduct(cache: CacheData, code: string): CachedProduct | undefined {
  const normalized = code.trim().toLowerCase();
  return cache.products[normalized];
}

export function setCachedProduct(cache: CacheData, code: string, data: Partial<CachedProduct>): void {
  const normalized = code.trim().toLowerCase();
  const existing = cache.products[normalized] || { code };
  cache.products[normalized] = { ...existing, ...data };
}

export function hasCachedStockResults(cache: CacheData, code: string): boolean {
  const product = getCachedProduct(cache, code);
  return !!(product?.stockResults && product.stockResults.length >= 0);
}

export function hasCachedMyGiftDetails(cache: CacheData, code: string): boolean {
  const product = getCachedProduct(cache, code);
  return !!(product?.myGiftDetails && product.myGiftDetails.code);
}

export function hasCachedMarketingContent(cache: CacheData, code: string): boolean {
  const product = getCachedProduct(cache, code);
  return !!(
    product?.marketingContent &&
    product.marketingContent.productTitle &&
    product.marketingContent.productTitle.trim() !== ""
  );
}
