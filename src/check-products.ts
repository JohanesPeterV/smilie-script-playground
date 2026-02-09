import dotenv from "dotenv";
dotenv.config({ override: true });

async function main() {
  const { db } = await import("./db");

  const mygiftProducts = await db.product.findMany({
    where: { supplier: "mygift", deletedAt: null },
    select: { sku: true, name: true },
    orderBy: { sku: "asc" },
  });

  console.log(`=== ${mygiftProducts.length} MyGift products ===\n`);
  for (const p of mygiftProducts) {
    console.log(`  ${p.sku.padEnd(10)} ${p.name}`);
  }

  await db.$disconnect();
}

main();
