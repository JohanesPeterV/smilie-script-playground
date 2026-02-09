import dotenv from "dotenv";
dotenv.config({ override: true });
import fs from "fs";

const code = process.argv[2] || "AM20";
const cache = JSON.parse(fs.readFileSync("cache.json", "utf8"));
const p = cache.products[code.trim().toLowerCase()];
if (p) {
  console.log("Code:", p.code);
  console.log("Stock Results:");
  for (const r of p.stockResults) {
    console.log(
      "  " +
        r.itemCode.padEnd(12) +
        r.description.padEnd(50) +
        "qty=" +
        String(r.quantity).padStart(6) +
        "  price=" +
        r.price
    );
  }
} else {
  console.log(`${code} not found in cache`);
}
