import dotenv from "dotenv";
dotenv.config({ override: true });

const log = createLogger("scraper-report.txt");

async function main() {
  // Dynamic imports so dotenv override takes effect before modules load
  const { db } = await import("./db");
  const { createBrowser, ProductVariantsScraper } = await import(
    "./smilie-item-data-generator/scrappers/product-variants-scraper"
  );
  const { loadCache, saveCache } = await import(
    "./smilie-item-data-generator/helpers/cache"
  );

  // 1. Fetch ALL MyGift product SKUs from the database
  console.log("[Scraper] Fetching all MyGift product codes from database...");
  const dbProducts = await db.product.findMany({
    select: { sku: true },
    where: {
      supplier: "mygift",
      deletedAt: null,
      sku: { not: "" },
    },
    orderBy: { sku: "asc" },
  });

  if (dbProducts.length === 0) {
    console.error("[Scraper] No MyGift products found in database. Exiting.");
    process.exit(1);
  }

  const products = dbProducts.map((p) => ({ code: p.sku }));
  console.log(`[Scraper] Found ${products.length} MyGift products to scrape`);

  // 2. Load cache (avoids re-scraping on reruns)
  const cache = loadCache();

  // 3. Launch browser and run scraper
  console.log("[Scraper] Launching browser...");
  const browser = await createBrowser();

  try {
    const scraper = new ProductVariantsScraper(browser);
    await scraper.init();

    const results = await scraper.scrapeProducts(products, cache);

    // 4. Save cache after completion
    saveCache(cache);

    // 5. Print summary + write report
    const withStock = results.filter((r) => r.results.length > 0);
    const withoutStock = results.filter((r) => r.results.length === 0);

    log(`\n[Scraper] === SUMMARY ===`);
    log(`  Total products: ${results.length}`);
    log(`  With stock data: ${withStock.length}`);
    log(`  No stock data: ${withoutStock.length}`);

    if (withoutStock.length > 0) {
      log(`\n  Products with no stock data:`);
      for (const p of withoutStock) {
        log(`    - ${p.code}`);
      }
    }

    log(`\n[Scraper] === DETAILED RESULTS ===`);
    for (const r of withStock) {
      log(`\n─── ${r.code} ───`);
      for (const v of r.results) {
        log(`  ${v.itemCode.padEnd(10)} ${v.description.padEnd(50)} qty=${String(v.quantity).padStart(6)}  price=${v.price}`);
      }
    }

    log(`\n[Scraper] Full results saved to cache.json`);
    log(`[Scraper] Report written to scraper-report.txt`);

    await scraper.close();
  } catch (error) {
    // Save cache even on error so we don't lose partial progress
    saveCache(cache);
    console.error("[Scraper] Failed:", error);
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}

function createLogger(filename: string) {
  const fs = require("fs");
  const path = require("path");
  const filePath = path.join(process.cwd(), filename);
  // Clear file on start
  fs.writeFileSync(filePath, `Report generated: ${new Date().toISOString()}\n\n`, "utf8");
  return (msg: string) => {
    console.log(msg);
    fs.appendFileSync(filePath, msg + "\n", "utf8");
  };
}

main();
