import { run } from "./smilie-item-data-generator";

console.log("Starting MyGift scraper...");
run().catch((error) => {
  console.error("Scraping failed:", error);
  process.exitCode = 1;
});
