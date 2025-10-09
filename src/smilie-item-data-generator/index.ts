import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

import loadProducts from "./data-loader/load-products";
import { generateCsv } from "./helpers/csv";

import { OpenAiMarketingContentGenerator } from "./open-ai/marketing-content-generator";
import { scrapeMyGiftDetails } from "./scrappers/product-details-scraper";
import {
  createBrowser,
  scrapeProducts,
} from "./scrappers/product-variants-scraper";
import type { MyGiftProductDetails, ProductStockResult } from "./types";

function createTimestampedFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${timestamp}.${extension}`;
}

function createDetailLookup(
  detailRecords: MyGiftProductDetails[],
): Map<string, MyGiftProductDetails> {
  return new Map(
    detailRecords
      .filter((detail) => detail.code)
      .map((detail) => [detail.code.trim().toLowerCase(), detail]),
  );
}

function mergeStockWithDetails(
  stockResults: ProductStockResult[],
  detailLookup: Map<string, MyGiftProductDetails>,
): ProductStockResult[] {
  return stockResults.map((stockItem) => {
    const detail = detailLookup.get(stockItem.code.trim().toLowerCase());
    const primaryImage = detail?.images?.[0] ?? stockItem.imageUrl;
    const imageSet = new Set<string>();

    const addIfPresent = (value?: string): void => {
      if (value) {
        imageSet.add(value);
      }
    };

    addIfPresent(primaryImage);
    (stockItem.images ?? []).forEach(addIfPresent);
    (detail?.images ?? []).forEach(addIfPresent);
    addIfPresent(stockItem.imageUrl);

    return {
      ...stockItem,
      imageUrl: primaryImage,
      myGift: detail ?? stockItem.myGift ?? null,
      images: Array.from(imageSet),
    };
  });
}

function appendMissingDetails(
  itemsWithExistingDetails: ProductStockResult[],
  detailRecords: MyGiftProductDetails[],
): ProductStockResult[] {
  for (const detail of detailRecords) {
    const normalized = detail.code.trim().toLowerCase();
    const alreadyIncluded = itemsWithExistingDetails.some(
      (item) => item.code.trim().toLowerCase() === normalized,
    );
    if (alreadyIncluded) {
      continue;
    }

    const imageSet = new Set<string>(detail.images ?? []);
    const primaryImage = detail.images?.[0] ?? "";

    itemsWithExistingDetails.push({
      code: detail.code,
      imageUrl: primaryImage,
      results: [],
      marketingContent: null,
      myGift: detail,
      images: Array.from(imageSet),
    });
  }

  return itemsWithExistingDetails;
}

const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function populateOpenAIMarketingCopy(
  itemsWithDetails: ProductStockResult[],
  imageDelayMs = 500,
): Promise<void> {
  for (const item of itemsWithDetails) {
    const selectedImage = item.myGift?.images?.[0] ?? item.images?.[0];

    try {
      const openAiMarketingContentGenerator =
        new OpenAiMarketingContentGenerator();
      const copy = await openAiMarketingContentGenerator.run({
        code: item.code,
        detail: item.myGift ?? null,
        imageUrl: selectedImage ?? undefined,
      });

      if (copy) {
        item.marketingContent = copy;
      }
    } catch (error) {
      console.error(
        `Failed to generate marketing copy for ${item.code}:`,
        error,
      );
    }

    if (imageDelayMs > 0) {
      await waitFor(imageDelayMs);
    }
  }
}

function writeOutputsToDisk(items: ProductStockResult[]): void {
  const csvContent = generateCsv(items);
  const csvFilename = createTimestampedFilename(
    "mygift-stock-and-specs",
    "csv",
  );
  const csvPath = path.join(process.cwd(), csvFilename);

  fs.writeFileSync(csvPath, csvContent, "utf8");
  console.log(`\nCSV file generated: ${csvFilename}`);
  console.log(`File path: ${csvPath}`);

  const jsonFilename = `${csvFilename.replace(/\.csv$/i, "")}.json`;
  const jsonPath = path.join(process.cwd(), jsonFilename);
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), "utf8");
  console.log(`\nJSON file generated: ${jsonFilename}`);
  console.log(`File path: ${jsonPath}`);

  console.log("\nCombined Output:");
  console.log(JSON.stringify(items, null, 2));
}

export async function run(): Promise<void> {
  const browser = await createBrowser();
  let detailRecords: MyGiftProductDetails[] = [];
  try {
    const products = loadProducts();
    const stockResults = await scrapeProducts(browser, products);
    try {
      detailRecords = await scrapeMyGiftDetails(browser, products);
    } catch (error) {
      console.error("MyGift detail scraping failed:", error);
    }

    const detailByCode = createDetailLookup(detailRecords);
    const stockWithDetails = mergeStockWithDetails(stockResults, detailByCode);
    const catalogWithDetails = appendMissingDetails(
      [...stockWithDetails],
      detailRecords,
    );

    await populateOpenAIMarketingCopy(catalogWithDetails);
    writeOutputsToDisk(catalogWithDetails);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error("Scraping failed:", error);
    process.exitCode = 1;
  });
}

export {
  ProductDetailsScrapper as MyGiftUniversalScraper,
  scrapeMyGiftDetails,
} from "./scrappers/product-details-scraper";
export {
  ProductVariantsScraper as ItemVariantsScraper,
  scrapeProducts as scrapeItems,
} from "./scrappers/product-variants-scraper";
