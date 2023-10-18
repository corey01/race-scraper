import puppeteer from "puppeteer";
import { britishSuperBikes } from "./utils/bsb.js";
import { writeJson } from "./utils/writeToJson.js";

const runScraper = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  // Open a new page
  const page = await browser.newPage();

  const bsb2023 = await britishSuperBikes(page, "2023");
  const bsb2024 = await britishSuperBikes(page, "2024");

  writeJson(bsb2023);
  writeJson(bsb2024);
};

// Start the scraping
runScraper();
