import dotenv from "dotenv";
dotenv.config({ override: true });

async function main() {
  // Dynamic imports so dotenv override takes effect before modules load
  const { db } = await import("./db");
  const { createBrowser, ProductVariantsScraper } = await import(
    "./smilie-item-data-generator/scrappers/product-variants-scraper"
  );
  const { loadCache, saveCache } = await import(
    "./smilie-item-data-generator/helpers/cache"
  );

  // 1. Fetch a few product SKUs from the database
  console.log("[Test] Fetching product codes from database...");
  const dbProducts = await db.product.findMany({
    select: { sku: true },
    where: { sku: { not: "" } },
    take: 3,
  });

  if (dbProducts.length === 0) {
    console.error("[Test] No products found in database. Exiting.");
    process.exit(1);
  }

  const products = dbProducts.map((p) => ({ code: p.sku }));
  console.log(
    "[Test] Product codes to scrape:",
    products.map((p) => p.code),
  );

  // 2. Load cache (avoids re-scraping on reruns)
  const cache = loadCache();

  // 3. Launch browser and run scraper
  console.log("[Test] Launching browser...");
  const browser = await createBrowser();

  try {
    const scraper = new ProductVariantsScraper(browser);
    await scraper.init();

    const results = await scraper.scrapeProducts(products, cache);

    // 4. Save cache for future reruns
    saveCache(cache);

    // 5. Print results
    console.log("\n[Test] === RESULTS ===");
    console.log(JSON.stringify(results, null, 2));

    await scraper.close();
  } catch (error) {
    console.error("[Test] Scraper failed:", error);
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}

main();
