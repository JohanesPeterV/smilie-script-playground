import dotenv from "dotenv";
dotenv.config({ override: true });

async function main() {
  const { db } = await import("./db");
  const fs = await import("fs");
  const path = await import("path");

  const cacheFile = path.join(process.cwd(), "cache.json");
  const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  const products = Object.values(cacheData.products) as any[];

  console.log(`\n=== DRY RUN: Sync ${products.length} products from cache ===\n`);

  for (const product of products) {
    console.log(`─── Product: ${product.code} ───`);

    // Phase 1: stockDescription
    const stockDescription = product.stockResults
      .map((x: any) => {
        const color = getColorInHackyWay(x.description);
        if (!color) return null;
        return `- ${color}: ${Number(x.quantity).toLocaleString()}`;
      })
      .filter((x: any) => x !== null)
      .join("\n");

    // Derive product price (all variants share the same price)
    const newPrice = product.stockResults[0]?.price ?? null;

    const dbProduct = await db.product.findUnique({
      where: { sku: product.code },
      select: { id: true, name: true, sku: true, stockDescription: true, price: true },
    });

    if (dbProduct) {
      const currentPrice = Number(dbProduct.price);
      const priceChanged = newPrice !== null && currentPrice !== newPrice;
      console.log(`  [Product] "${dbProduct.name}" (sku: ${dbProduct.sku})`);
      console.log(`  [Price] ${currentPrice} → ${newPrice}${priceChanged ? " (CHANGED)" : " (no change)"}`);
      console.log(`  [Current stockDescription]:`);
      console.log(`    ${(dbProduct.stockDescription || "(empty)").replace(/\n/g, "\n    ")}`);
      console.log(`  [New stockDescription]:`);
      console.log(`    ${stockDescription.replace(/\n/g, "\n    ")}`);
      console.log(`  [Action] Would UPDATE Product.stockDescription${priceChanged ? " + price" : ""}`);
    } else {
      console.log(`  [Product] NOT FOUND in DB for sku="${product.code}" — would SKIP`);
    }

    // Phase 2: color option stock
    for (const variant of product.stockResults) {
      const pco = await db.productColorOption.findFirst({
        where: { sku: variant.itemCode },
        select: { id: true, color: true, sku: true, stock: true, productId: true },
      });

      if (pco) {
        const currentStock = pco.stock ? Number(pco.stock) : null;
        const newStock = variant.quantity;
        const changed = currentStock !== newStock;
        console.log(`  [ColorOption] sku="${variant.itemCode}" color="${pco.color}" | stock: ${currentStock ?? "(null)"} → ${newStock}${changed ? " (CHANGED)" : " (no change)"}`);
      } else {
        console.log(`  [ColorOption] sku="${variant.itemCode}" — NOT FOUND in DB, would SKIP`);
      }
    }

    console.log();
  }

  console.log("=== DRY RUN COMPLETE — no database writes were made ===\n");
  await db.$disconnect();
}

function getColorInHackyWay(description: string): string {
  const words = description.split(" ");
  const colorWords = words.filter((word) => !/^[A-Z0-9]+$/.test(word));
  return colorWords.join(" ");
}

main();
