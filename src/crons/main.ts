import "dotenv/config";
import { CronJob } from "cron";
import { loadDataFromCacheToProduct } from "../smilie-item-data-generator/load-data-from-cache-to-product/main";

const timeZone = "Asia/Singapore";

CronJob.from({
  cronTime: "0 3 * * *", // https://crontab.guru/#0_3_*_*_*
  onTick: async () => {
    await loadDataFromCacheToProduct();
  },
  start: true,
  timeZone,
});
