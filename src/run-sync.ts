import dotenv from "dotenv";
dotenv.config({ override: true });

async function main() {
  const { loadDataFromCacheToProduct } = await import(
    "./smilie-item-data-generator/load-data-from-cache-to-product/main"
  );
  const { db } = await import("./db");

  console.log(`=== SYNC START: ${new Date().toISOString()} ===`);
  console.log("Syncing cache.json → database...\n");

  await loadDataFromCacheToProduct();

  console.log(`\n=== SYNC COMPLETE: ${new Date().toISOString()} ===`);
  await db.$disconnect();
}

main();
