import { db } from "../../db";
import loadProducts from "../data-loader/load-products";
import {
  createBrowser,
  scrapeProducts,
} from "../scrappers/product-variants-scraper";
import type { StockRow } from "../types";

type ScrapedProduct = {
  code: string;
  stockResults: StockRow[];
};

export async function loadDataFromCacheToProduct() {
  // Phase 0: scrape live stock from MyGift
  console.log(`\n========================================`);
  console.log(`[cron] Scraping live stock at ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  const productList = loadProducts();
  const browser = await createBrowser();
  let products: ScrapedProduct[];
  try {
    const stockResults = await scrapeProducts(browser, productList, {
      products: {},
    });
    products = stockResults.map((r) => ({
      code: r.code,
      stockResults: r.results,
    }));
  } finally {
    await browser.close();
  }

  const stats = {
    productUpdated: 0,
    productNotFound: 0,
    productError: 0,
    colorUpdated: 0,
    colorNotFound: 0,
    colorError: 0,
  };

  console.log(`\n========================================`);
  console.log(`[cron] Starting DB sync at ${new Date().toISOString()}`);
  console.log(`[cron] Products to process: ${products.length}`);
  console.log(`========================================\n`);

  // Reconnect Prisma to avoid stale connections
  await db.$connect();

  await Promise.all(
    products.map(async (product) => {
      // phase 1: update product stock description
      try {
        const stockDescription = product.stockResults
          .map((x) => {
            const color = getColorInHackyWay(x.description);
            if (!color) {
              return null;
            }
            return `- ${color}: ${Number(x.quantity).toLocaleString()}`;
          })
          .filter((x) => x !== null)
          .join("\n");

        console.log(
          `Update product ${product.code}: start...`,
          stockDescription
        );

        // Check if product exists before updating
        const existingProduct = await db.product.findUnique({
          where: { sku: product.code },
        });

        if (!existingProduct) {
          console.warn(`Update product ${product.code}: not found in DB, skipping`);
          stats.productNotFound++;
          return;
        }

        await db.product.update({
          where: {
            sku: product.code,
          },
          data: {
            stockDescription,
            updatedAt: new Date(),
          },
        });

        console.log(`Update product ${product.code}: success`);
        stats.productUpdated++;
      } catch (error) {
        console.warn(`Update product ${product.code}: error`, error);
        stats.productError++;
      }

      // phase 2: update product color options stock by found SKU
      await Promise.all(
        product.stockResults.map(async (productVariant) => {
          try {
            console.log(
              `Update color SKU "${productVariant.itemCode}": start...`
            );

            const pco = await db.productColorOption.findFirst({
              where: {
                sku: productVariant.itemCode,
              },
            });

            if (!pco) {
              console.warn(
                `Update color SKU "${productVariant.itemCode}": not found`
              );
              stats.colorNotFound++;
              return;
            }

            await db.productColorOption.update({
              where: {
                id: pco.id,
              },
              data: {
                stock: productVariant.quantity,
                updatedAt: new Date(),
              },
            });

            console.log(
              `Update color SKU "${productVariant.itemCode}": success`
            );
            stats.colorUpdated++;
          } catch (error) {
            console.warn(
              `Update color SKU "${productVariant.itemCode}": error`,
              error
            );
            stats.colorError++;
          }
        })
      );
    })
  );

  // Disconnect after run to clean up
  await db.$disconnect();

  console.log(`\n========================================`);
  console.log(`[cron] Sync completed at ${new Date().toISOString()}`);
  console.log(`[cron] Results:`);
  console.log(`  Products updated:   ${stats.productUpdated}`);
  console.log(`  Products not found: ${stats.productNotFound}`);
  console.log(`  Products errors:    ${stats.productError}`);
  console.log(`  Colors updated:     ${stats.colorUpdated}`);
  console.log(`  Colors not found:   ${stats.colorNotFound}`);
  console.log(`  Colors errors:      ${stats.colorError}`);
  console.log(`========================================\n`);
}

function getColorInHackyWay(description: string): string {
  const words = description.split(" ");

  const colorWords = words.filter((word) => isWordNotColor(word));

  return colorWords.join(" ");
}

function isWordNotColor(word: string): boolean {
  return !/^[A-Z0-9]+$/.test(word);
}
