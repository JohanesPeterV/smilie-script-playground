import type { Browser, Page } from "puppeteer";
import type { CacheData } from "../helpers/cache";
import {
  getCachedProduct,
  hasCachedMyGiftDetails,
  setCachedProduct,
} from "../helpers/cache";
import type { MyGiftProductDetails, Product } from "../types";

const BASE_URL = "https://www.mygiftuniversal.com";
const SEARCH_PATH = "/products-listing/product/listing";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SPEC_FIELD_ALIASES: Record<
  | keyof Omit<
      MyGiftProductDetails,
      "code" | "name" | "url" | "images" | "printingMethods"
    >
  | "printingMethods",
  string[]
> = {
  material: ["material", "materials"],
  dimension: ["dimension", "dimensions", "size"],
  weight: ["weight"],
  finished: ["finished", "finish", "finishing"],
  function: ["function", "functions"],
  printingMethods: ["printingmethods", "printingmethod", "printing"],
};

type SearchResult = {
  title: string | null;
  link: string;
  image: string | null;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class ProductDetailsScrapper {
  private page?: Page;

  constructor(private readonly browser: Browser) {}

  async init(): Promise<void> {
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(45000);
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent(USER_AGENT);
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
  }

  async scrapeItems(
    items: Product[],
    cache: CacheData,
  ): Promise<MyGiftProductDetails[]> {
    const results: MyGiftProductDetails[] = [];

    for (const item of items) {
      if (hasCachedMyGiftDetails(cache, item.code)) {
        const cached = getCachedProduct(cache, item.code);
        console.log(`[Cache Hit] Using cached MyGift details for ${item.code}`);
        if (cached?.myGiftDetails) {
          results.push(cached.myGiftDetails);
        }
        continue;
      }

      try {
        console.log(`[Scraping] MyGift details for: ${item.code}`);
        const detail = await this.scrapeItem(item);
        if (detail) {
          results.push(detail);
          setCachedProduct(cache, item.code, { myGiftDetails: detail });
          console.log(`Captured details for ${item.code}`);
        } else {
          const emptyDetail = { code: item.code, images: [] };
          results.push(emptyDetail);
          setCachedProduct(cache, item.code, { myGiftDetails: emptyDetail });
          console.warn(`No MyGift detail found for ${item.code}`);
        }
      } catch (error) {
        console.error(
          `Failed to capture MyGift detail for ${item.code}:`,
          error,
        );
        const emptyDetail = { code: item.code, images: [] };
        results.push(emptyDetail);
        setCachedProduct(cache, item.code, { myGiftDetails: emptyDetail });
      }

      await sleep(750);
    }

    return results;
  }

  private getPage(): Page {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call init() before use.");
    }
    return this.page;
  }

  private async scrapeItem(
    item: Product,
  ): Promise<MyGiftProductDetails | null> {
    const page = this.getPage();
    const searchResult = await this.searchProduct(item.code);
    if (!searchResult) {
      return null;
    }

    const productUrl = searchResult.link;
    await this.gotoWithChallenge(productUrl, ".hikashop_product_page");

    const detail = await page.evaluate(
      (fieldAliases, origin) => {
        const aliasMap: Record<string, string> = {};
        Object.entries(fieldAliases).forEach(([key, aliases]) => {
          aliases.forEach((alias) => {
            aliasMap[alias] = key;
          });
        });

        const specs: Record<string, string> = {};
        const collectFromTable = (table: HTMLTableElement): void => {
          const rows = Array.from(table.querySelectorAll("tr"));
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td,th");
            if (cells.length < 2) {
              return;
            }
            const label = cells[0]?.textContent ?? "";
            const value = cells[1]?.textContent ?? "";
            const normalized = (label ?? "")
              .toLowerCase()
              .replace(/[^a-z]/g, "");
            const key = aliasMap[normalized];
            if (!key) {
              return;
            }
            if (specs[key]) {
              return;
            }
            const cleaned = value.replace(/\s+/g, " ").trim();
            if (cleaned) {
              specs[key] = cleaned;
            }
          });
        };

        const tables = Array.from(
          document.querySelectorAll<HTMLTableElement>(
            "#hikashop_product_description_main table, div[id^='hikashop_product_description_'] table, div[id^='hikashop_product_custom_value_'] table",
          ),
        );
        tables.forEach(collectFromTable);

        if (!Object.keys(specs).length) {
          const rows = Array.from(
            document.querySelectorAll(".hikashop_product_page tr"),
          );
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td,th");
            if (cells.length < 2) {
              return;
            }
            const label = cells[0]?.textContent ?? "";
            const value = cells[1]?.textContent ?? "";
            const normalized = (label ?? "")
              .toLowerCase()
              .replace(/[^a-z]/g, "");
            const key = aliasMap[normalized];
            if (!key || specs[key]) {
              return;
            }
            const cleaned = value.replace(/\s+/g, " ").trim();
            if (cleaned) {
              specs[key] = cleaned;
            }
          });
        }

        const makeAbsolute = (
          url: string | null | undefined,
        ): string | null => {
          if (!url) {
            return null;
          }
          try {
            return new URL(url, origin).href;
          } catch {
            return null;
          }
        };

        const imageSet = new Set<string>();
        const imageAnchors = document.querySelectorAll<HTMLAnchorElement>(
          "[id^='hikashop_product_image'] a[href]",
        );
        imageAnchors.forEach((anchor) => {
          const absolute = makeAbsolute(anchor.getAttribute("href"));
          if (absolute) {
            imageSet.add(absolute);
          }
        });

        if (!imageSet.size) {
          const imgs = document.querySelectorAll<HTMLImageElement>(
            "[id^='hikashop_product_image'] img[src]",
          );
          imgs.forEach((img) => {
            const absolute = makeAbsolute(img.getAttribute("src"));
            if (absolute) {
              imageSet.add(absolute);
            }
          });
        }

        const variantName =
          Array.from(
            document.querySelectorAll("[id^='hikashop_product_name_']"),
          )
            .map((el) => el.textContent?.trim() ?? "")
            .find((text) => text && !text.includes("Please select")) ?? "";

        const fallbackName =
          document
            .querySelector<HTMLElement>(
              "[itemprop='name'], .hikashop_product_name_main, h1",
            )
            ?.textContent?.trim() ?? "";

        return {
          specs,
          images: Array.from(imageSet),
          rawName: variantName || fallbackName || null,
        };
      },
      SPEC_FIELD_ALIASES,
      BASE_URL,
    );

    const uniqueImages = new Set<string>(detail.images ?? []);
    if (!uniqueImages.size && searchResult.image) {
      uniqueImages.add(searchResult.image);
    }

    const printingValue = detail.specs.printingMethods;
    const printingMethods = printingValue
      ? Array.from(
          new Set(
            printingValue
              .split(/[,/]/)
              .map((method) => method.trim())
              .filter(Boolean),
          ),
        )
      : undefined;

    const result: MyGiftProductDetails = {
      code: item.code,
      url: productUrl,
      name: detail.rawName ? detail.rawName.split(":")[0].trim() : undefined,
      images: Array.from(uniqueImages),
    };

    const assignSpec = (key: keyof typeof SPEC_FIELD_ALIASES): void => {
      const value = detail.specs[key];
      if (value) {
        if (key === "printingMethods") {
          if (printingMethods?.length) {
            result.printingMethods = printingMethods;
          }
        } else {
          result[key] = value;
        }
      }
    };

    (
      Object.keys(SPEC_FIELD_ALIASES) as Array<keyof typeof SPEC_FIELD_ALIASES>
    ).forEach(assignSpec);

    return result;
  }

  private async searchProduct(code: string): Promise<SearchResult | null> {
    const query = new URLSearchParams({
      limitstart: "0",
      filter_Search_8: code,
    }).toString();

    const searchUrl = `${BASE_URL}${SEARCH_PATH}?${query}`;
    await this.gotoWithChallenge(searchUrl, ".hikashop_products_listing");

    const page = this.getPage();
    const results = (await page.evaluate(() => {
      const products = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".hikashop_products_listing .hikashop_product",
        ),
      );
      return products.map((node) => {
        const title =
          node
            .querySelector<HTMLAnchorElement>(".hikashop_product_name a")
            ?.textContent?.trim() ?? null;
        const link =
          node.querySelector<HTMLAnchorElement>(".hikashop_product_name a")
            ?.href ??
          node.querySelector<HTMLAnchorElement>("a")?.href ??
          null;
        const image =
          node.querySelector<HTMLImageElement>("img")?.src ??
          node.querySelector<HTMLAnchorElement>("a[href*='/images/']")?.href ??
          null;
        return link
          ? {
              title,
              link,
              image,
            }
          : null;
      });
    })) as Array<SearchResult | null>;

    const cleaned: SearchResult[] = results.filter(
      (result): result is SearchResult => result !== null,
    );
    if (!cleaned.length) {
      return null;
    }

    const normalizedCode = code.trim().toLowerCase();
    const directMatch = cleaned.find((entry) => {
      const title = entry.title?.toLowerCase();
      if (!title) {
        return false;
      }
      return title.includes(normalizedCode);
    });
    return directMatch ?? cleaned[0];
  }

  private async gotoWithChallenge(
    url: string,
    waitForSelector?: string,
  ): Promise<void> {
    const page = this.getPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await this.waitForChallengeResolution(page);
    if (waitForSelector) {
      await page
        .waitForSelector(waitForSelector, { timeout: 15000 })
        .catch(() => undefined);
    }
    await sleep(250);
  }

  private async waitForChallengeResolution(page: Page): Promise<void> {
    await page
      .waitForFunction(
        () => {
          const title = document.title?.toLowerCase() ?? "";
          const challengeVisible = document.querySelector("#outer-container");
          return !title.includes("one moment") && !challengeVisible;
        },
        { timeout: 20000 },
      )
      .catch(() => undefined);
  }
}

export async function scrapeMyGiftDetails(
  browser: Browser,
  items: Product[],
  cache: CacheData,
): Promise<MyGiftProductDetails[]> {
  const scraper = new ProductDetailsScrapper(browser);
  await scraper.init();
  try {
    return await scraper.scrapeItems(items, cache);
  } finally {
    await scraper.close();
  }
}
