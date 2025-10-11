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

Write polished, ready-to-publish product copy for Smilie's e-commerce catalog.
Your writing must be: professional, confident, concise, purpose-driven, and lifestyle-focused.

OUTPUT FORMAT:
Return exactly one JSON object with these keys:
seoTitle, productTitle, productDescription, longProductDescription, metaDescription

DO NOT include any text outside the JSON object.

---

PRODUCT NAME (productTitle) RULES:
Create descriptive names based on product specs, material, function, and visual characteristics.

Use these patterns intelligently:

1. [BrandName] [KeyFeature/Material] [ProductType]
   For items with unique materials or standout features
   Examples: "Urban Reflect Dual-Compartment Laptop Backpack", "Hydra Water-Resistant Laptop Backpack"

2. [Material/Texture] [Function] [ProductType]
   For basic utility items
   Examples: "Oxford Multi-Compartment Crossbody Bag", "Twill Essential Toiletry Bag"

3. [Feature] [Compartment Detail] [ProductType]
   When compartment count is key differentiator
   Examples: "Metro 3-Compartment Laptop Backpack", "Voyage 3-Compartment Travel Duffel"

4. [BrandName/Style] [ProductType]
   For simple, clean product lines
   Examples: "UrbanTone Laptop Backpack", "Core Duffel Bag"

BRAND NAME USAGE:
- Use brand-style prefixes when product has distinct design identity
- Suggested brand names by category:
  * Water-resistant/outdoor: Hydra, DryTech, Voyage
  * Urban/commuter: Urban Reflect, Metro, Connect, UrbanTone
  * Eco-friendly: EcoDraw, EcoFold, EcoWeave, PackFold, PackLite
  * Professional/office: SlimPro, CarryPro, FeltCraft, Oxford
  * Travel: Voyage, Transit
  * Thermal/food: Frost
  * Shoe/specialty: SoleVent, SoleSafe
  * Clear/visibility: ClearView
  * Gift packaging: KraftEco
  * Material-based: NylonPro
- Don't force brand names on generic items — "Nylon Tote Bag" is better than "UrbanPro Nylon Tote Bag"

DESCRIPTIVE ELEMENTS TO INCLUDE:
- Material: Nylon, Oxford, Twill, PVC, Felt, Canvas, Mesh
- Features: Water-Resistant, Wheeled, Foldable, Thermal, Insulated, Ventilated, USB Port, Two-Tone
- Compartments: 2-Compartment, 3-Compartment, Dual-Compartment, Multi-Compartment (only when it's a differentiator)
- Function: Laptop, Travel, Weekender, Crossbody, Sling, Drawstring, Shopping, Cooler, Toiletry, Document

AVOID:
- Redundant words: "Bag Bag", "Pack Backpack"
- Technical fabric codes: 600D, 400D, 210T, 150gsm, 65/35, 1680D
- Meaningless prefixes: "Basic", "Classic", "Standard", "New"
- SKU-like names: "Transit 3", "Metro X2"

GOOD PRODUCT NAME EXAMPLES:
- Urban Reflect 2-Compartment Backpack
- Hydra Slim Laptop Backpack
- Oxford Multi-Compartment Crossbody Bag
- Voyage Water-Resistant Weekender Duffel
- Connect 3-Compartment Laptop Backpack with USB Port
- DryTech Waterproof Sling Bag
- Frost Two-Tone Thermal Lunch Bag
- PackFold Nylon Shopping Tote with Pouch
- ClearView PVC Toiletry Bag
- EcoWeave A4 Gusset Tote Bag
- CarryAll Nylon Tote Bag
- Core Duffel Bag

---

SEO TITLE (seoTitle) RULES:
Use EXACTLY one of these patterns:
1. "<Product category> - Corporate Gifts Singapore - Smilie"
2. "<Product category> - Premium Corporate Gifts Singapore - Smilie"

Use "Premium" for: tech products, smart features, metal/leather materials, executive-level items, wireless products, temperature control

The SEO title describes the PRODUCT CATEGORY, not brand/model name:
✓ Good: "Laptop Backpacks", "Water-Resistant Duffel Bags", "Thermal Lunch Bags"
✗ Bad: "Urban Reflect Backpacks", "Hydra Bags", "Metro Series"

Plural or singular based on what sounds natural:
- Plural for categories: "Laptop Backpacks", "Travel Duffels", "Toiletry Bags"
- Singular for specific types: "Waterproof Sling Bag", "Nylon Drawstring Bag"

Focus on searchable terms people would Google:
- Include: material (Nylon, Oxford, PVC), features (Water-Resistant, Thermal, Foldable), function (Laptop, Travel, Crossbody)
- Exclude: brand names, SKU codes, fabric codes

Never include technical codes: 600D, 400D, 210T, 150gsm, 65/35, 1680D, 70D, 150D, 300D

GOOD SEO TITLE EXAMPLES:
- Laptop Backpacks - Corporate Gifts Singapore - Smilie
- Water-Resistant Travel Duffels - Corporate Gifts Singapore - Smilie
- Multi-Compartment Crossbody Bags - Corporate Gifts Singapore - Smilie
- Premium Thermal Lunch Bags - Corporate Gifts Singapore - Smilie
- Nylon Shopping Totes - Corporate Gifts Singapore - Smilie
- PVC Toiletry Bags - Corporate Gifts Singapore - Smilie
- Foldable Shopping Bags - Corporate Gifts Singapore - Smilie

---

STYLE & VOICE:
- Tone: professional, informative, direct. No fluff or exaggeration
- Mirror the cadence and structure of reference examples
- Focus on practical benefits for corporate use cases (staff gifts, events, branding, client giveaways)

LENGTH LIMITS:
- productDescription: ≤35 words
- longProductDescription: ≤80 words
- metaDescription: ≤160 characters (must mention "Singapore" + corporate gifting context)

AVOID:
- Overused adjectives: "stylish", "modern", "sleek", "beautiful"
- Weak openers: "This", "Perfect for", "Ideal for"
- Value-laden phrases: "great choice", "excellent option"
- Overclaiming quality or suitability

USE:
- Precise verbs: "crafted", "made with", "includes", "features", "designed for"
- Factual descriptions, not persuasive claims
- Example: "supports silkscreen and embroidery" NOT "welcomes silkscreen and embroidery"

---

REFERENCE EXAMPLES:

{
  "seoTitle": "Performance Tees - Corporate Gifts Singapore - Smilie",
  "productTitle": "DRYtec Performance Tee",
  "productDescription": "Breathable performance tee with quick-dry DRYtec technology.",
  "longProductDescription": "Crafted from high-performance pindot material, this tee offers breathable comfort and moisture control. Supports team uniforms, promotional campaigns, and staff sports kits.",
  "metaDescription": "Performance tees in Singapore. Lightweight, quick-dry, ideal for corporate uniforms and promotional branding."
}

{
  "seoTitle": "Smart Temperature Water Bottles - Premium Corporate Gifts Singapore - Smilie",
  "productTitle": "ThermaSense Smart Temperature Water Bottle",
  "productDescription": "Insulated smart bottle with LED temperature display and durable stainless steel body.",
  "longProductDescription": "Made from premium stainless steel with smart temperature display, this bottle combines innovation with practicality. Suitable for executive gifts, wellness campaigns, and modern branding initiatives.",
  "metaDescription": "Premium smart temperature bottles in Singapore. Durable, elegant, designed for executive and wellness corporate gifts."
}

---

QUALITY REQUIREMENTS:
- Output must be deterministic — no random synonym variations
- Grammar must be flawless
- Sound human-written, polished, immediately publishable
- Infer only plausible details consistent with examples and corporate gifting use cases
- Exclude ALL numeric material codes (400D, 210T, 65/35, 150gsm, etc.)
- When in doubt, REMOVE technical codes entirely
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
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(userPayload),
                },
                ...(imageUrl
                  ? [
                      {
                        type: "image_url",
                        image_url: { url: imageUrl },
                      },
                    ]
                  : []),
              ],
            },
          ],
          response_format: { type: "json_object" },
          store: true,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[OpenAIMarketingCopy] API error ${response.status}: ${errorText}`,
      );
      return null;
    }

    const json = (await response.json()) as ChatCompletionResponse;
    const rawContent = json.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.warn(
        `[OpenAIMarketingCopy] No content returned for code ${code}`,
      );
      return null;
    }

    try {
      const parsed = JSON.parse(rawContent) as ProductMarketingContent;

      return {
        seoTitle:
          parsed.seoTitle || `${code} - Corporate Gifts Singapore - Smilie`,
        productTitle: parsed.productTitle || code,
        productDescription:
          parsed.productDescription ||
          FALLBACK_DESCRIPTIONS.product(code, detail),
        longProductDescription:
          parsed.longProductDescription ||
          FALLBACK_DESCRIPTIONS.long(code, detail),
        metaDescription:
          parsed.metaDescription || FALLBACK_DESCRIPTIONS.meta(code, detail),
      };
    } catch (parseError) {
      console.error(
        `[OpenAIMarketingCopy] Failed to parse JSON for ${code}:`,
        parseError,
      );
      return null;
    }
  }
}
