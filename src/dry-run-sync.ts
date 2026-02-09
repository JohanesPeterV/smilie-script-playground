import dotenv from "dotenv";
dotenv.config({ override: true });

const REPORT_FILE = "sync-report.txt";

function createLogger(filename: string) {
  const fs = require("fs");
  const path = require("path");
  const filePath = path.join(process.cwd(), filename);
  fs.writeFileSync(filePath, `Sync Report generated: ${new Date().toISOString()}\n\n`, "utf8");
  return (msg: string) => {
    console.log(msg);
    fs.appendFileSync(filePath, msg + "\n", "utf8");
  };
}

const log = createLogger(REPORT_FILE);

async function main() {
  const { db } = await import("./db");
  const fs = await import("fs");
  const path = await import("path");

  const cacheFile = path.join(process.cwd(), "cache.json");
  const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  const products = Object.values(cacheData.products) as any[];

  log(`=== DRY RUN: Sync ${products.length} products from cache ===\n`);

  let productUpdates = 0;
  let colorUpdates = 0;
  let productSkips = 0;
  let colorSkips = 0;

  for (const product of products) {
    log(`═══ Product: ${product.code} ═══`);

    // Build stockDescription
    const stockDescription = product.stockResults
      .map((x: any) => {
        const color = extractColor(x.description);
        if (!color) return null;
        return `- ${color}: ${Number(x.quantity).toLocaleString("en-US")}`;
      })
      .filter((x: any) => x !== null)
      .join("\n");

    const price = product.stockResults[0]?.price;

    // Build update data (same logic as actual sync)
    const updateData: Record<string, unknown> = {
      stockDescription,
      ...(price != null ? { price } : {}),
    };

    const marketing = product.marketingContent;
    if (marketing) {
      if (marketing.seoTitle) updateData.seoTitle = marketing.seoTitle;
      if (marketing.metaDescription)
        updateData.metaDescription = marketing.metaDescription;
      if (marketing.productDescription)
        updateData.description = marketing.productDescription;
      if (marketing.longProductDescription)
        updateData.longDescription = marketing.longProductDescription;
    }

    const myGift = product.myGiftDetails;
    if (myGift) {
      const specParts: string[] = [];
      if (myGift.material) specParts.push(`Material: ${myGift.material}`);
      if (myGift.dimension) specParts.push(`Dimension: ${myGift.dimension}`);
      if (myGift.weight) specParts.push(`Weight: ${myGift.weight}`);
      if (myGift.finished) specParts.push(`Finished: ${myGift.finished}`);
      if (myGift.function) specParts.push(`Function: ${myGift.function}`);
      if (specParts.length > 0) {
        updateData.specsDescription = specParts.join("\n");
      }
      if (myGift.images && myGift.images.length > 0) {
        updateData.imageUrls = myGift.images;
      }
    }

    // Case-insensitive lookup
    const dbProduct = await db.product.findFirst({
      where: { sku: { equals: product.code, mode: "insensitive" } },
      select: { id: true, name: true, sku: true },
    });

    if (dbProduct) {
      productUpdates++;
      log(`\n  db.product.update({`);
      log(`    where: { id: "${dbProduct.id}" },  // "${dbProduct.name}" (sku: ${dbProduct.sku})`);
      log(`    data: ${JSON.stringify(updateData, null, 6).replace(/\n/g, "\n    ")}`);
      log(`  })\n`);
    } else {
      productSkips++;
      log(`  SKIP — sku="${product.code}" not found in DB\n`);
    }

    // Color option updates
    for (const variant of product.stockResults) {
      const pco = await db.productColorOption.findFirst({
        where: {
          sku: { equals: variant.itemCode, mode: "insensitive" },
        },
        select: { id: true, color: true, sku: true, stock: true },
      });

      if (pco) {
        colorUpdates++;
        const currentStock = pco.stock ? Number(pco.stock) : null;
        log(`  db.productColorOption.update({`);
        log(`    where: { id: "${pco.id}" },  // color="${pco.color}" sku="${pco.sku}" currentStock=${currentStock}`);
        log(`    data: { stock: ${variant.quantity} }`);
        log(`  })\n`);
      } else {
        colorSkips++;
        log(`  SKIP — colorOption sku="${variant.itemCode}" not found in DB\n`);
      }
    }

    log(``);
  }

  log(`=== DRY RUN SUMMARY ===`);
  log(`  Product updates: ${productUpdates}`);
  log(`  Product skips (not in DB): ${productSkips}`);
  log(`  Color option updates: ${colorUpdates}`);
  log(`  Color option skips (not in DB): ${colorSkips}`);
  log(`\n=== DRY RUN COMPLETE — no database writes were made ===`);
  log(`Report saved to: ${REPORT_FILE}`);

  await db.$disconnect();
}

function extractColor(description: string): string {
  const match = description.match(
    /\d+\s*(?:ML|L|OZ)\s+(.+?)\s+[A-Z]{2,}\s+\d+\s*$/i
  );
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  const words = description.split(" ");
  return words.filter((w) => !/^[A-Z0-9]+$/.test(w)).join(" ");
}

main();
