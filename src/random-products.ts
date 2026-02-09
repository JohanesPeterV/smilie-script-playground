import dotenv from "dotenv";
dotenv.config({ override: true });

async function main() {
  const { db } = await import("./db");
  const products = await db.product.findMany({
    where: { supplier: "mygift", deletedAt: null },
    select: { sku: true, name: true },
  });
  const shuffled = products.sort(() => Math.random() - 0.5).slice(0, 5);
  for (const p of shuffled) {
    console.log(`${p.sku.padEnd(10)} ${p.name}`);
  }
  await db.$disconnect();
}

main();
