import * as fs from "fs";
import * as path from "path";
import type { Product } from "../types";

function parseCsv(csvContent: string): Product[] {
  const lines = csvContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(",");
  const codeIndex = headers.findIndex((header) => header.trim() === "code");

  if (codeIndex === -1) {
    throw new Error('CSV must contain a "code" column');
  }

  const items: Product[] = [];

  for (let i = 1; i < lines.length; i++) {
    const record = parseCsvLine(lines[i]);
    const code = record[codeIndex]?.trim();
    if (!code) {
      continue;
    }

    items.push({ code });
  }

  return items;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

export default function loadProducts(): Product[] {
  const csvPath = path.join(__dirname, "../files/products.csv");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Products CSV file not found at: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");
  return parseCsv(csvContent);
}
