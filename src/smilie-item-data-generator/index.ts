import puppeteer, { Browser, Page } from "puppeteer";
import { Item, items } from "./item";

type StockRow = {
  itemCode: string;
  description: string;
  quantity: number;
  price: number;
};

type ItemStockResult = {
  code: string;
  imageUrl?: string;
  results: StockRow[];
};

const BASE_URL = "https://mygiftuniversal.com.my";
const CHECK_STOCK_PATH = "/admin_sg.php";
const USERNAME = "agent";
const PASSWORD = "0000";
const CHECK_STOCK_SEARCH_SELECTOR = 'input[name="search"]';
const RESULTS_ROW_SELECTOR = "#listDiv tr[id^='tr_']";

async function login(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#UserName1", { timeout: 15000 });
  await page.type("#UserName1", username, { delay: 25 });
  await page.type("#Pass1", password, { delay: 25 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.click("#Submit1"),
  ]);

  if (!page.url().includes("calculator.php")) {
    throw new Error("Login failed: expected to land on calculator page.");
  }
}

async function ensureCheckStockPage(page: Page): Promise<void> {
  if (!page.url().includes(CHECK_STOCK_PATH)) {
    await page.goto(`${BASE_URL}${CHECK_STOCK_PATH}`, {
      waitUntil: "domcontentloaded",
    });
  }

  await page.waitForSelector(CHECK_STOCK_SEARCH_SELECTOR, { timeout: 15000 });
}

async function searchStockForItem(
  page: Page,
  code: string
): Promise<StockRow[]> {
  await ensureCheckStockPage(page);

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
            firstCell?.textContent?.trim().toUpperCase().startsWith(prefix) ?? false
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
        .filter((row): row is {
          itemCode: string;
          description: string;
          quantityText: string;
          priceText: string;
        } => row !== null),
    searchPrefix
  );

  if (rows.length === 0) {
    const noRecord =
      (await page.$eval(
        "#listDiv",
        (table) => table.textContent?.includes("----- No Record -----") ?? false
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

async function scrapeItems(
  browser: Browser,
  itemList: Item[]
): Promise<ItemStockResult[]> {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await login(page, USERNAME, PASSWORD);
  await ensureCheckStockPage(page);

  const results: ItemStockResult[] = [];

  for (const item of itemList) {
    try {
      console.log(`Searching for item: ${item.code}`);
      const stockRows = await searchStockForItem(page, item.code);
      results.push({
        code: item.code,
        imageUrl: item.imageUrl,
        results: stockRows,
      });
      console.log(`Found ${stockRows.length} results for ${item.code}`);
    } catch (error) {
      results.push({
        code: item.code,
        imageUrl: item.imageUrl,
        results: [],
      });
      console.error(`Failed to retrieve stock for ${item.code}:`, error);
    }

    // Add delay between requests to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await page.close();
  return results;
}

export async function run(): Promise<void> {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const data = await scrapeItems(browser, items);
    console.log(JSON.stringify(data, null, 2));
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error("Scraping failed:", error);
    process.exitCode = 1;
  });
}

export { searchStockForItem };
