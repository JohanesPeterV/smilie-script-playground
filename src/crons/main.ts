import { CronJob } from "cron";
import { loadDataFromCacheToProduct } from "../smilie-item-data-generator/load-data-from-cache-to-product/main";

const timeZone = "Asia/Singapore";

CronJob.from({
  cronTime: "0 0 3 * * *",
  onTick: async () => {
    await loadDataFromCacheToProduct();
  },
  start: true,
  timeZone,
});
