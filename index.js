import puppeteer from "puppeteer";
import { bsb } from "./utils/bsb.js";
import { writeJson } from "./utils/writeToJson.js";
import { wsbk } from './utils/wsbk.js';
import { fimSpeedway } from "./utils/fimSpeedway.js";
import { formula1 } from "./utils/f1.js";

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
  const wsbkData = await wsbk(page);
  console.log("Starting FIM Speedway");
  const fimSpeedwayData = await fimSpeedway(page, "2026");
  console.log("Starting Formula 1");
  const formula1Data = await formula1(page, "2026");
  console.log("Starting BSB");
  const bsbData = await bsb(page, "2026");
  // console.log("Starting MotoGP");
  // const motoGP = await motogp(page);
  
  console.log("*** DONE SCRAPING ****");
  page.close();
  // console.log("Writing Data...");
  writeJson(wsbkData)
  //   console.log("Done writing");

  //   process.exit(0);
  // }).catch((err) => {
  //   console.log("Error writing", err);
  // });
  // writeJson(bsb2023);
  writeJson(bsbData);
  writeJson(fimSpeedwayData);
  writeJson(formula1Data);
  // writeJson(motoGP);
  
  console.log("Done writing");
 


  
};

// Start the scraping
runScraper();
