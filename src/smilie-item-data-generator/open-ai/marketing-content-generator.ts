import { getOptionalEnv } from "../helpers/env";
import type { MyGiftProductDetails, ProductMarketingContent } from "../types";

export type OpenAIMarketingContentRequest = {
  code: string;
  detail?: MyGiftProductDetails | null;
  imageUrl?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

const FALLBACK_DESCRIPTIONS = {
  product: (code: string, detail?: MyGiftProductDetails | null) =>
    detail?.function
      ? `Experience the ${code}, designed for ${detail.function.toLowerCase()}.`
      : `Discover the ${code}, crafted for dependable daily use.`,
  long: (code: string, detail?: MyGiftProductDetails | null) => {
    const material = detail?.material
      ? `Constructed with ${detail.material}, `
      : "";
    const functionText = detail?.function
      ? `${detail.function} for everyday convenience.`
      : "ideal for busy professionals and students alike.";
    return `${material}the ${code} delivers reliable performance and ${functionText}`;
  },
  meta: (code: string, detail?: MyGiftProductDetails | null) =>
    detail?.material
      ? `Shop the ${code} made from ${detail.material} for durable, everyday versatility.`
      : `Shop the ${code} for reliable performance and everyday versatility.`,
};

const SYSTEM_PROMPT = `
  You are an assistant that writes concise e-commerce marketing copy in English."
  Return a JSON object with the keys:"
  - seoTitle
  - productTitle
  - productDescription
  - longProductDescription
  - metaDescription
  some notes you must remember:
  - dont include codes such as BP96 for seo title and product name
  - long product description must be tailored for corporate gifting. SELL IT to corporates. the target audience is corporate companies.
example: This sustainable notebook aligns with green branding campaigns and is perfect for eco-conscious clients or employee kits.
  - dont list product specs that are irrelevant to the target audience such as "600d"
  Examples:
  [
    {
      "seoTitle": "DRYtec Performance Tees - Corporate Gifts Singapore - Smilie",
      "productTitle": "DRYtec Performance Tee 150gsm",
      "productDescription": "150gsm pindot fabric tee with quick-dry DRYtec technology.",
      "longProductDescription": "Crafted from 100% performance pindot material, this tee is designed for unisex wear with maximum breathability. A practical choice for team uniforms, promotional campaigns, or staff sports kits.",
      "metaDescription": "150gsm DRYtec performance tees in Singapore. Lightweight, quick-dry, and perfect for corporate uniforms and promotional branding."
    },
    {
      "seoTitle": "24 oz Macaron Stainless Steel Water Bottles - Corporate Gifts Singapore - Smilie",
      "productTitle": "Aurora Macaron Stainless Steel Water Bottle",
      "productDescription": "Trendy stainless steel water bottle with pastel macaron colours.",
      "longProductDescription": "This stylish water bottle brings a playful pop of colour while offering durable stainless steel construction. A practical gift for roadshows, youth campaigns, or wellness events where style meets function.",
      "metaDescription": "Colourful stainless steel bottles in Singapore. Trendy, durable, and perfect for lifestyle and corporate gifting."
    }
    {
      "seoTitle": "Performance Dry Pique Tees - Corporate Gifts Singapore - Smilie",
      "productTitle": "Performance Dry Pique Tee 160gsm",
      "productDescription": "Lightweight 160gsm dry pique tee designed for comfort and active use.",
      "longProductDescription": "Made with 100% performance fabric, this tee offers breathable comfort and quick-dry functionality. Ideal for company events, sports days, or large-scale giveaways where style and performance meet affordability.",
      "metaDescription": "Lightweight 160gsm dry pique tees in Singapore. Breathable, quick-dry, and perfect for corporate events or team activities."
    },
    {
      "seoTitle": "DRYtec Performance Tees - Corporate Gifts Singapore - Smilie",
      "productTitle": "DRYtec Performance Tee 150gsm",
      "productDescription": "150gsm pindot fabric tee with quick-dry DRYtec technology.",
      "longProductDescription": "Crafted from 100% performance pindot material, this tee is designed for unisex wear with maximum breathability. A practical choice for team uniforms, promotional campaigns, or staff sports kits.",
      "metaDescription": "150gsm DRYtec performance tees in Singapore. Lightweight, quick-dry, and perfect for corporate uniforms and promotional branding."
    },
    {
      "seoTitle": "18 oz Macaron Stainless Steel Water Bottles - Corporate Gifts Singapore - Smilie",
      "productTitle": "Aurora Macaron Stainless Steel Water Bottle",
      "productDescription": "Trendy stainless steel water bottle with pastel macaron colours.",
      "longProductDescription": "This stylish water bottle brings a playful pop of colour while offering durable stainless steel construction. A practical gift for roadshows, youth campaigns, or wellness events where style meets function.",
      "metaDescription": "Colourful stainless steel bottles in Singapore. Trendy, durable, and perfect for lifestyle and corporate gifting."
    },
    {
      "seoTitle": "3-Piece Laptop Backpack Set - Corporate Gifts Singapore - Smilie",
      "productTitle": "Axis Trio Laptop Backpack Set",
      "productDescription": "Compact laptop backpack set with three-piece design, practical for work and study.",
      "longProductDescription": "This versatile 3-piece business backpack set includes a laptop bag, secondary organiser, and matching accessory pouch. Ideal for corporate giveaways, staff welcome packs, or student essentials. Stylish yet affordable, offering branding opportunities across all pieces.",
      "metaDescription": "Affordable 3-piece laptop backpack set in Singapore. Practical, stylish, and great for staff gifts or corporate events."
    },
    {
      "seoTitle": "Custom Travel Compression Bag - Corporate Gifts Singapore - Smilie",
      "productTitle": "Axis PackSmart Compression Travel Bag",
      "productDescription": "Custom logo compression bag for travel and storage efficiency.",
      "longProductDescription": "Perfect for travel campaigns or employee gifts, this vacuum compression bag allows users to save luggage space and organise belongings neatly. Durable, reusable, and ideal for eco-conscious brands promoting practical lifestyle products.",
      "metaDescription": "Reusable compression travel bag with custom logo option. Great for corporate giveaways, travel branding, and lifestyle promotions."
    },
    {
      "seoTitle": "Large Waterproof Business Backpack - Corporate Gifts Singapore - Smilie",
      "productTitle": "Summit Explorer Waterproof Backpack",
      "productDescription": "Durable backpack with waterproof design and spacious compartments.",
      "longProductDescription": "With a water-resistant build and multi-functional compartments, this backpack is designed for daily commutes, outdoor activities, or business travel. A practical gift choice for companies that want to combine style with long-lasting usability.",
      "metaDescription": "Spacious waterproof multi-functional backpack in Singapore. Strong, durable, and ideal for staff gifts or outdoor corporate events."
    }
  ]
  Base the copy on the provided specifications and single image URL."
  Keep the tone professional, highlight benefits, avoid repeating specs verbatim, and never mention missing information."
  Limit productDescription to 35 words, longProductDescription to 80 words, and metaDescription to 160 characters."
`;

export class OpenAiMarketingContentGenerator {
  private hasLoggedMissingKey = false;

  constructor(
    private readonly apiKeyResolver: () => string | null = () =>
      getOptionalEnv("OPENAI_API_KEY") ??
      getOptionalEnv("OPEN_API_KEY") ??
      null,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async run({
    code,
    detail,
    imageUrl,
  }: OpenAIMarketingContentRequest): Promise<ProductMarketingContent | null> {
    const apiKey = this.apiKeyResolver();

    if (!apiKey) {
      if (!this.hasLoggedMissingKey) {
        console.warn(
          "OPENAI_API_KEY not set. Skipping marketing copy generation."
        );
        this.hasLoggedMissingKey = true;
      }
      return null;
    }

    const userPayload = {
      productCode: code,
      productName: detail?.name ?? null,
      imageUrl: imageUrl ?? null,
      material: detail?.material ?? null,
      dimension: detail?.dimension ?? null,
      weight: detail?.weight ?? null,
      finished: detail?.finished ?? null,
      function: detail?.function ?? null,
      printingMethods: detail?.printingMethods ?? null,
    };

    console.log(
      `[OpenAIMarketingCopy] Generating copy for ${code} using image ${
        imageUrl ?? "none"
      }`
    );

    const response = await this.fetchImpl(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.6,
          max_tokens: 600,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Product context: ${JSON.stringify(userPayload)}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenAI request failed with status ${response.status}: ${errText}`
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI response missing content.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse OpenAI JSON response: ${content}`);
    }

    const copy = parsed as Partial<ProductMarketingContent>;
    const fallback = (value: string | undefined, fallbackValue: string) =>
      value && value.trim().length > 0 ? value.trim() : fallbackValue;

    const result: ProductMarketingContent = {
      seoTitle: fallback(
        copy.seoTitle,
        detail?.name ? `${detail.name} | ${code}` : `Premium ${code} Product`
      ),
      productTitle: fallback(
        copy.productTitle,
        detail?.name ?? `Product ${code}`
      ),
      productDescription: fallback(
        copy.productDescription,
        FALLBACK_DESCRIPTIONS.product(code, detail)
      ),
      longProductDescription: fallback(
        copy.longProductDescription,
        FALLBACK_DESCRIPTIONS.long(code, detail)
      ),
      metaDescription: fallback(
        copy.metaDescription,
        FALLBACK_DESCRIPTIONS.meta(code, detail)
      ),
    };

    console.log(`[OpenAIMarketingCopy] Generated copy for ${code}`);
    return result;
  }
}
