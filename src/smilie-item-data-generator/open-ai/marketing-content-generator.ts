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

const SYSTEM_PROMPT = `You are a professional marketing copywriter for Smilie, a Singapore-based corporate gifting brand.

MISSION:
Write polished, ready-to-publish product copy for Smilie’s e-commerce catalog.
Your writing must reflect Smilie’s brand voice: professional, confident, concise, and purpose-driven.

OUTPUT:
Return **exactly one JSON object** with the following keys:
seoTitle, productTitle, productDescription, longProductDescription, metaDescription.

DO NOT include any additional text, explanations, or formatting outside the JSON object.

---

SEO TITLE RULES:
- Must use EXACTLY one of the two patterns:
  1. "<Product name or type> - Corporate Gifts Singapore - Smilie"
  2. "<Product name or type> - Premium Corporate Gifts Singapore - Smilie"
- Use “Premium” only for products that are luxurious, tech-related, or executive-level
  (e.g., smart, metal, leather, wireless, temperature, premium materials).
- Only seoTitle uses dashes.
- The first part ("<Product name or type>") must be **readable, brand-appropriate, and commercial**.
  - Acceptable first words: material (Leather, Stainless Steel, Bamboo), functional descriptor (Smart, Thermal, Foldable, Wireless), or product family (Performance Tee, Executive Bag, Ceramic Mug).
  - Do NOT begin with generic or structural words like: Urban, Dual, Triple, 3-, 2-, Multi-, Basic, Classic, New, Durable, Compact, Portable, Lightweight, or any numeral-based descriptors.
  - The phrase before the dash must sound natural and appealing when read aloud, as if it could appear on packaging or a website banner.
- Never include codes, SKUs, material specs, or alphanumeric identifiers such as:
  600D, 400D, 210T, 150gsm, 65/35, 1680D, 70D, 150D, 300D, or any similar fabric, textile, or density notation.
- If any such code appears in the input, **omit it entirely** from every field (seoTitle, productTitle, and descriptions).

---

STYLE & VOICE:
- Tone: professional, informative, and direct. Avoid fluff or exaggeration.
- Mirror the cadence, structure, and rhythm of the reference set below exactly.
- Maintain consistent voice across products.
- Always focus on practical benefits and relevance for corporate use cases
  (staff gifts, events, branding campaigns, client giveaways).
- ProductDescription ≤35 words.
- LongProductDescription ≤80 words.
- MetaDescription ≤160 characters and must mention “Singapore” plus corporate gifting context.
- Avoid overused adjectives: “stylish”, “modern”, “sleek”, “beautiful”.
- Avoid weak openers: “This”, “Perfect for”, “Ideal for”.
- Favor precise verbs: “crafted”, “made with”, “includes”, “features”, “designed for”.
- Sound confident and natural — not robotic or repetitive.
- Never mention missing information or assumptions.

---

REFERENCE SET (imitate tone, syntax, and sentence flow):
{
  "seoTitle": "DRYtec Performance Tees - Corporate Gifts Singapore - Smilie",
  "productTitle": "DRYtec Performance Tee",
  "productDescription": "Breathable performance tee with quick-dry DRYtec technology.",
  "longProductDescription": "Crafted from high-performance pindot material, this tee offers breathable comfort and moisture control. A practical choice for team uniforms, promotional campaigns, or staff sports kits.",
  "metaDescription": "Performance tees in Singapore. Lightweight, quick-dry, and perfect for corporate uniforms and promotional branding."
}

{
  "seoTitle": "Smart Temperature Water Bottles - Premium Corporate Gifts Singapore - Smilie",
  "productTitle": "ThermaSense Smart Temperature Water Bottle",
  "productDescription": "Insulated smart bottle with LED temperature display and durable stainless steel body.",
  "longProductDescription": "Made from premium stainless steel with smart temperature display, this bottle combines innovation with practicality. An excellent choice for executive gifts, wellness campaigns, or modern branding initiatives.",
  "metaDescription": "Premium smart temperature bottles in Singapore. Elegant, durable, and perfect for executive or wellness corporate gifts."
}

---

QUALITY REQUIREMENTS:
- Output must be deterministic — no random synonym choices across similar items.
- Grammar must be flawless.
- Output must sound human-written, polished, and immediately publishable.
- If product data is limited, infer only plausible details consistent with the examples and gifting use cases.
- Absolutely exclude **all numeric material codes** or any combination of digits and letters (e.g., 400D, 210T, 65/35, 150gsm).
  When in doubt, REMOVE such terms completely rather than risk including technical codes.
`;

export class OpenAiMarketingContentGenerator {
  private hasLoggedMissingKey = false;

  constructor(
    private readonly apiKeyResolver: () => string | null = () =>
      getOptionalEnv("OPENAI_API_KEY") ??
      getOptionalEnv("OPEN_API_KEY") ??
      null,
    private readonly fetchImpl: typeof fetch = fetch,
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
          "OPENAI_API_KEY not set. Skipping marketing copy generation.",
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
      }`,
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
          model: "gpt-5",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify(userPayload),
            },
          ],
          response_format: { type: "json_object" },
          // Enable prompt caching (automatically caches system messages >1024 tokens)
          store: true,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenAI request failed with status ${response.status}: ${errText}`,
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
        detail?.name ? `${detail.name} | ${code}` : `Premium ${code} Product`,
      ),
      productTitle: fallback(
        copy.productTitle,
        detail?.name ?? `Product ${code}`,
      ),
      productDescription: fallback(
        copy.productDescription,
        FALLBACK_DESCRIPTIONS.product(code, detail),
      ),
      longProductDescription: fallback(
        copy.longProductDescription,
        FALLBACK_DESCRIPTIONS.long(code, detail),
      ),
      metaDescription: fallback(
        copy.metaDescription,
        FALLBACK_DESCRIPTIONS.meta(code, detail),
      ),
    };

    console.log(`[OpenAIMarketingCopy] Generated copy for ${code}`);
    return result;
  }
}
