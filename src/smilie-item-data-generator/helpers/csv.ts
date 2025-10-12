import { ProductStockResult } from "../types";

function escapeCsvField(field: string | undefined | null): string {
  if (!field) return "";
  const value = String(field);
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function extractColour(description?: string | null): string {
  if (!description) {
    return "";
  }

  const tokens = description.split(/\s+/).filter((token) => token.length > 0);
  const colourTokens: string[] = [];
  let collecting = false;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];

    if (/^[A-Z0-9]+$/.test(token)) {
      if (collecting) {
        break;
      }
      continue;
    }

    if (!/[a-z]/.test(token)) {
      if (collecting) {
        break;
      }
      continue;
    }

    collecting = true;
    colourTokens.unshift(token[0].toUpperCase() + token.slice(1));
  }

  return colourTokens.join(" ");
}

function buildProductSpecs(detail?: ProductStockResult["myGift"]): string {
  if (!detail) return "";

  const parts: string[] = [];

  const append = (label: string, value?: string) => {
    if (value && value.trim().length > 0) {
      parts.push(`${label} : ${value.trim()}`);
    }
  };

  append("Material", detail.material);
  append("Dimension", detail.dimension);
  append("Weight", detail.weight);
  append("Finished", detail.finished);
  append("Function", detail.function);

  if (detail.printingMethods?.length) {
    append("Printing Methods", detail.printingMethods.join(" / "));
  }

  return parts.join("\n");
}

export function generateCsv(data: ProductStockResult[]): string {
  const headers = [
    "Essential",
    "Item Code",
    "Item SKU",
    "Parent Cat",
    "Sub Cat",
    "Price",
    "Quantity",
    "Colour",
    "Hex code",
    "Product Specs",
    "SEO Title",
    "Product Title",
    "Product Descrption",
    "Long Product Description",
    "Meta Description",
  ];

  const rows: string[] = [headers.map(escapeCsvField).join(",")];

  for (const item of data) {
    const productSpecs = buildProductSpecs(item.myGift ?? null);
    const marketing = item.marketingContent ?? null;

    // First row: main product with marketing content
    const mainRow = [
      "", // Essential (empty)
      item.code, // Item Code (main product code)
      "", // Item SKU (empty for main product)
      item.parentCat ?? "", // Parent Cat
      item.subCat ?? "", // Sub Cat
      "", // Price (empty for main product)
      "", // Quantity (empty for main product)
      "", // Colour (empty for main product)
      "", // Hex code
      productSpecs,
      marketing?.seoTitle ?? "",
      marketing?.productTitle ?? "",
      marketing?.productDescription ?? "",
      marketing?.longProductDescription ?? "",
      marketing?.metaDescription ?? "",
    ];
    rows.push(mainRow.map(escapeCsvField).join(","));

    // Variant rows: only Item SKU, Price, Quantity, and Colour filled
    if (item.results.length > 0) {
      for (const variant of item.results) {
        const price =
          typeof variant.price === "number" && !Number.isNaN(variant.price)
            ? variant.price.toString()
            : "";
        const quantity =
          variant.quantity !== undefined && variant.quantity !== null
            ? variant.quantity.toString()
            : "";

        const variantRow = [
          "", // Essential (empty)
          "", // Item Code (empty for variants)
          variant.itemCode, // Item SKU (variant code)
          "", // Parent Cat
          "", // Sub Cat
          price,
          quantity,
          extractColour(variant.description),
          "", // Hex code
          "", // Product Specs (empty for variants)
          "", // SEO Title (empty for variants)
          "", // Product Title (empty for variants)
          "", // Product Description (empty for variants)
          "", // Long Product Description (empty for variants)
          "", // Meta Description (empty for variants)
        ];
        rows.push(variantRow.map(escapeCsvField).join(","));
      }
    }
  }

  return rows.join("\n");
}
