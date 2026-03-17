import "dotenv/config";
import { loadDataFromCacheToProduct } from "../smilie-item-data-generator/load-data-from-cache-to-product/main";

console.log("[manual trigger] Starting loadDataFromCacheToProduct...");

loadDataFromCacheToProduct()
  .then(() => {
    console.log("[manual trigger] Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[manual trigger] Fatal error:", error);
    process.exit(1);
  });
