// https://www.worldsbk.com/en/calendar

export const worldSuperbikes = async (page) => {
  await page.goto(`https://www.worldsbk.com/en/calendar`, {
    waitUntil: "domcontentloaded",
  });
  page.waitForNavigation({ waitUntil: ["load", "networkidle2"] });

  // const rounds = await page.evaluate(() => {
  //   const tags = document.querySelectorAll("#circuit_calendar > li");

  //   return [...tags].map((tag) => tag.children[0].href).filter(Boolean);
  // });

  let roundsWithDetail = [];

  const rounds = ["https://www.worldsbk.com/en/event/AUS/2023"];

  for (let i = 0; i < rounds.length; i++) {
    await page.goto(rounds[i], {
      waitUntil: "domcontentloaded",
    });

    const eventInfo = await page.$eval(".title-event-circuit", (e) => {
      return {
        date: e.children[2].innerText,
        title: e.children[1].innerText,
        type: e.children[0].innerText,
      };
    });

    await page.click(".schedule-tab");
    const pageData = await page.$eval(".days-tabs", (e) => {
      return [...e.children].map((child) => {
        child.click();
        document.querySelector(".time-tabs").children[0].children[1].click();
        const sessionsData = document.querySelector(".table-sessions").children;
        return [...sessionsData].map((sess) => ({
          startTime: sess[0],
          endTime: sess[1],
          name: sess[2],
        }));
      });
    });

    console.log(pageData);

    roundsWithDetail.push({ eventInfo, pageData });
  }

  // return data;
  // }

  // roundsWithDetail.push({
  //   data
  // });

  // await page.click(rounds[0]);
  //   await page.waitForNavigation({ waitUntil: "networkidle2" });
  //   const titleBox = await page.$(".title-event-circuit");
  //   await page.click(".schedule-tab");

  //   roundsWithDetail.push({
  //     type: titleBox.children[0].innerText,
  //     title: titleBox.children[1].innerText,
  //     date: titleBox.children[2].innerText,
  //   });
  // }

  // console.log(roundsWithDetail);

  // await page.click("#circuit_calendar > li");

  // const rounds = await page.evaluate(() => {
  //   const calendar = document.getElementById("circuit_calendar");

  //   page.click(calendar.children[0]);
  // });

  // console.log(rounds);
  // });

  console.log(roundsWithDetail);
};

// Page.$$()
