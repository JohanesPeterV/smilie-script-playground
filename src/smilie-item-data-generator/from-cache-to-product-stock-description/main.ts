import cacheJson from "../../../cache.json";
import { db } from "../../db";

async function main() {
  const data = Object.values(cacheJson.products)
    .flatMap((x) => {
      return x.stockResults.map((y) => ({
        sku: x.code,
        description: y.description,
        color: getColorInHackyWay(y.description),
        quantity: y.quantity,
      }));
    })
    .filter((x) => !!x.color);

  const stockInformationBySku = data.reduce((acc, curr) => {
    if (!acc[curr.sku]) {
      acc[curr.sku] = [];
    }
    acc[curr.sku].push(`- ${curr.color}: ${curr.quantity}`);
    return acc;
  }, {} as Record<string, string[]>);

  const skus = Object.keys(stockInformationBySku);

  await Promise.all(
    skus.map(async (sku) => {
      try {
        const stockDescription = stockInformationBySku[sku].join("\n");

        console.log(`Update product ${sku}: start...`, stockDescription);

        await db.product.update({
          where: {
            sku,
          },
          data: {
            stockDescription,
          },
        });

        console.log(`Update product ${sku}: success`);
      } catch (error) {
        console.warn(`Update product ${sku}: error`, error);
      }
    })
  );
}

main();

function getColorInHackyWay(description: string): string {
  const words = description.split(" ");

  const colorWords = words.filter((word) => isWordNotColor(word));

  return colorWords.join(" ");
}

function isWordNotColor(word: string): boolean {
  return !/^[A-Z0-9]+$/.test(word);
}
