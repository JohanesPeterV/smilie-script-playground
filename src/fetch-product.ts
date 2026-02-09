import dotenv from "dotenv";
dotenv.config({ override: true });

async function main() {
  const { db } = await import("./db");
  const codes = process.argv.slice(2);

  for (const code of codes) {
    const product = await db.product.findFirst({
      where: { sku: { equals: code, mode: "insensitive" } },
      include: {
        productColorOptions: {
          select: { sku: true, color: true, stock: true },
        },
      },
    });

    if (!product) {
      console.log(`\n${code}: NOT FOUND in DB\n`);
      continue;
    }

    console.log(`\n═══ ${product.sku} — ${product.name} ═══`);
    console.log(`  id:               ${product.id}`);
    console.log(`  price:            ${product.price}`);
    console.log(`  stockDescription: ${product.stockDescription}`);
    console.log(`  deletedAt:        ${product.deletedAt}`);
    console.log(`  supplier:         ${(product as any).supplier}`);
    console.log(`  Color Options:`);
    for (const co of product.productColorOptions) {
      console.log(`    ${(co.sku || "").padEnd(12)} color="${co.color}"  stock=${co.stock}`);
    }
  }

  await db.$disconnect();
}

main();
