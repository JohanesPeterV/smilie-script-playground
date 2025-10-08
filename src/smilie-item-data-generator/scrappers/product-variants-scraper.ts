import type { Browser, Page } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getRequiredEnv } from "../helpers/env";
import type { Product } from "../types";
import { ProductStockResult, StockRow } from "../types";

puppeteerExtra.use(StealthPlugin());

const BASE_URL = getRequiredEnv("BASE_URL");
const CHECK_STOCK_PATH = getRequiredEnv("CHECK_STOCK_PATH");
const USERNAME = getRequiredEnv("USERNAME");
const PASSWORD = getRequiredEnv("PASSWORD");
const CHECK_STOCK_SEARCH_SELECTOR = getRequiredEnv(
  "CHECK_STOCK_SEARCH_SELECTOR"
);
const RESULTS_ROW_SELECTOR = getRequiredEnv("RESULTS_ROW_SELECTOR");

export class ProductVariantsScraper {
  private page?: Page;

  constructor(private readonly browser: Browser) {}

  async init(): Promise<void> {
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(45000);
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await this.login();
    await this.ensureCheckStockPage();
  }

  async scrapeProducts(itemList: Product[]): Promise<ProductStockResult[]> {
    const results: ProductStockResult[] = [];

    for (const item of itemList) {
      try {
        console.log(`Searching for item: ${item.code}`);
        const stockRows = await this.searchStockForItem(item.code);

        results.push({
          code: item.code,
          results: stockRows,
        });
        console.log(`Found ${stockRows.length} results for ${item.code}`);
      } catch (error) {
        results.push({
          code: item.code,
          results: [],
        });
        console.error(`Failed to retrieve stock for ${item.code}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
  }

  private getPage(): Page {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call init() before use.");
    }
    return this.page;
  }

  private async login(): Promise<void> {
    const page = this.getPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#UserName1", { timeout: 15000 });
    await page.type("#UserName1", USERNAME, { delay: 25 });
    await page.type("#Pass1", PASSWORD, { delay: 25 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click("#Submit1"),
    ]);

    if (!page.url().includes("calculator.php")) {
      throw new Error("Login failed: expected to land on calculator page.");
    }
  }

  private async ensureCheckStockPage(): Promise<void> {
    const page = this.getPage();
    if (!page.url().includes(CHECK_STOCK_PATH)) {
      await page.goto(`${BASE_URL}${CHECK_STOCK_PATH}`, {
        waitUntil: "domcontentloaded",
      });
    }

    await page.waitForSelector(CHECK_STOCK_SEARCH_SELECTOR, { timeout: 15000 });
  }

  private async searchStockForItem(code: string): Promise<StockRow[]> {
    const page = this.getPage();
    await this.ensureCheckStockPage();

    await page.focus(CHECK_STOCK_SEARCH_SELECTOR);

    const searchPrefix = code.trim().toUpperCase();

    const navigationPromise = page
      .waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 45000,
      })
      .catch(() => null);

    await page.evaluate(
      (selector, value) => {
        const input = document.querySelector<HTMLInputElement>(selector);
        if (!input) {
          throw new Error("Search input not found");
        }

        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        const form =
          input.form ||
          document.querySelector<HTMLFormElement>("#control_panel");

        if (!form) {
          throw new Error("Check Stock form not found");
        }

        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
      },
      CHECK_STOCK_SEARCH_SELECTOR,
      code
    );

    await navigationPromise;

    try {
      await page.waitForFunction(
        (rowSelector, prefix, noRecordText) => {
          const container = document.querySelector("#listDiv");
          if (!container) {
            return false;
          }
          const text = container.textContent ?? "";
          if (text.includes(noRecordText)) {
            return true;
          }

          const rows = Array.from(
            document.querySelectorAll<HTMLTableRowElement>(rowSelector)
          );

          if (!rows.length) {
            return false;
          }

          return rows.some((row) => {
            const firstCell = row.querySelector<HTMLTableCellElement>(
              "td.database_content"
            );
            return (
              firstCell?.textContent?.trim().toUpperCase().startsWith(prefix) ??
              false
            );
          });
        },
        { timeout: 45000 },
        RESULTS_ROW_SELECTOR,
        searchPrefix,
        "----- No Record -----"
      );
    } catch (error) {
      const snippet =
        (await page.$eval(
          "#listDiv",
          (table) => table.textContent?.slice(0, 200) ?? ""
        )) || "";
      throw new Error(
        `Timed out waiting for refreshed results for ${code}. Table snippet: ${snippet}`
      );
    }

    const rows = await page.$$eval(
      RESULTS_ROW_SELECTOR,
      (tableRows, prefix) =>
        tableRows
          .map((row) => {
            const cells = Array.from(
              row.querySelectorAll<HTMLTableCellElement>("td.database_content")
            );

            const itemCode = cells[0]?.textContent?.trim() ?? "";
            if (!itemCode.toUpperCase().startsWith(prefix)) {
              return null;
            }

            return {
              itemCode,
              description: cells[1]?.textContent?.trim() ?? "",
              quantityText: cells[2]?.textContent?.trim() ?? "",
              priceText: cells[3]?.textContent?.trim() ?? "",
            };
          })
          .filter(
            (
              row
            ): row is {
              itemCode: string;
              description: string;
              quantityText: string;
              priceText: string;
            } => row !== null
          ),
      searchPrefix
    );

    if (rows.length === 0) {
      const noRecord =
        (await page.$eval(
          "#listDiv",
          (table) =>
            table.textContent?.includes("----- No Record -----") ?? false
        )) || false;
      if (noRecord) {
        return [];
      }
    }

    return rows.map((row) => ({
      itemCode: row.itemCode,
      description: row.description,
      quantity: Number(row.quantityText.replace(/,/g, "")) || 0,
      price: Number(row.priceText.replace(/[^0-9.]/g, "")) || 0,
    }));
  }
}

export async function scrapeProducts(
  browser: Browser,
  itemList: Product[]
): Promise<ProductStockResult[]> {
  const scraper = new ProductVariantsScraper(browser);
  await scraper.init();
  try {
    return await scraper.scrapeProducts(itemList);
  } finally {
    await scraper.close();
  }
}

export async function createBrowser(): Promise<Browser> {
  return puppeteerExtra.launch({
    headless: true,
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,720",
    ],
  });
}
