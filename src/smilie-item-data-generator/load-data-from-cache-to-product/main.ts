import cacheJson from "../../../cache.json";
import { db } from "../../db";

async function main() {
  const products = Object.values(cacheJson.products);

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

        await db.product.update({
          where: {
            sku: product.code,
          },
          data: {
            stockDescription,
          },
        });

        console.log(`Update product ${product.code}: success`);
      } catch (error) {
        console.warn(`Update product ${product.code}: error`, error);
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
              return;
            }

            await db.productColorOption.update({
              where: {
                id: pco.id,
              },
              data: {
                stock: productVariant.quantity,
              },
            });

            console.log(
              `Update color SKU "${productVariant.itemCode}": success`
            );
          } catch (error) {
            console.warn(
              `Update color SKU "${productVariant.itemCode}": error`,
              error
            );
          }
        })
      );
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
