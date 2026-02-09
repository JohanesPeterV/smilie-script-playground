import cacheJson from "../../../cache.json";
import { db } from "../../db";

export async function loadDataFromCacheToProduct() {
  const products = Object.values(cacheJson.products);

  await Promise.all(
    products.map(async (product) => {
      // phase 1: update product stock description, price, and marketing/specs
      try {
        const stockDescription = product.stockResults
          .map((x) => {
            const color = extractColor(x.description);
            if (!color) {
              return null;
            }
            return `- ${color}: ${Number(x.quantity).toLocaleString("en-US")}`;
          })
          .filter((x) => x !== null)
          .join("\n");

        const price = product.stockResults[0]?.price;

        // Build update data
        const updateData: Record<string, unknown> = {
          stockDescription,
          ...(price != null ? { price } : {}),
        };

        // Sync marketing content if available
        const marketing = (product as any).marketingContent;
        if (marketing) {
          if (marketing.seoTitle) updateData.seoTitle = marketing.seoTitle;
          if (marketing.metaDescription)
            updateData.metaDescription = marketing.metaDescription;
          if (marketing.productDescription)
            updateData.description = marketing.productDescription;
          if (marketing.longProductDescription)
            updateData.longDescription = marketing.longProductDescription;
        }

        // Sync MyGift specs if available
        const myGift = (product as any).myGiftDetails;
        if (myGift) {
          const specParts: string[] = [];
          if (myGift.material) specParts.push(`Material: ${myGift.material}`);
          if (myGift.dimension)
            specParts.push(`Dimension: ${myGift.dimension}`);
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

        console.log(
          `Update product ${product.code}: start...`,
          stockDescription
        );

        // Case-insensitive SKU lookup, then update by id
        const dbProduct = await db.product.findFirst({
          where: { sku: { equals: product.code, mode: "insensitive" } },
        });

        if (!dbProduct) {
          console.warn(
            `Update product ${product.code}: not found in DB, skipping`
          );
          return;
        }

        await db.product.update({
          where: { id: dbProduct.id },
          data: updateData,
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

            // Case-insensitive SKU lookup
            const pco = await db.productColorOption.findFirst({
              where: {
                sku: {
                  equals: productVariant.itemCode,
                  mode: "insensitive",
                },
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

/**
 * Extracts color name from a supplier description string.
 * Handles both mixed-case and all-uppercase descriptions.
 *
 * Example inputs:
 *   "MYGIFT AUTO MUG 450ML Red AM 1205" → "Red"
 *   "MYGIFT AUTO MUG 450ML Royal Blue AM 1208" → "Royal Blue"
 *   "MYGIFT AUTO MUG 450ML RED AM 1205" → "RED"
 */
function extractColor(description: string): string {
  // Try regex: capture text between size spec (e.g. "450ML") and trailing code (e.g. "AM 1205")
  const match = description.match(
    /\d+\s*(?:ML|L|OZ)\s+(.+?)\s+[A-Z]{2,}\s+\d+\s*$/i
  );
  if (match && match[1].trim()) {
    return match[1].trim();
  }

  // Fallback: filter out all-uppercase/digit-only words
  const words = description.split(" ");
  return words.filter((w) => !/^[A-Z0-9]+$/.test(w)).join(" ");
}
