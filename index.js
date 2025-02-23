import puppeteer from "puppeteer";
import { britishSuperBikes } from "./utils/bsb.js";
import { writeJson } from "./utils/writeToJson.js";
import { motogp } from "./utils/motogp.js";
import { wsbk } from './utils/wsbk.js';

const runScraper = async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    headless: 'new',
    defaultViewport: null,
  });

  // Open a new page
  const page = await browser.newPage();
  
  // const bsb2023 = await britishSuperBikes(page, "2023");
  console.log("Starting WSBK");
  const wsbk2025 = await wsbk(page);
  // console.log("Starting BSB");
  // const bsb2025 = await britishSuperBikes(page, "2025");
  // console.log("Starting MotoGP");
  // const motoGP = await motogp(page);
  
  console.log("*** DONE SCRAPING ****");
  page.close();
  console.log("Writing Data...");
  writeJson(wsbk2025).then(() => {
    console.log("Done writing");

    process.exit(0);
  }).catch((err) => {
    console.log("Error writing", err);
  });
  // writeJson(bsb2023);
  // writeJson(bsb2025);
  // writeJson(motoGP);
  
  console.log("Done writing");
 


  
};

// Start the scraping
runScraper();
