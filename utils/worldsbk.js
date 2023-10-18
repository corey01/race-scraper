// https://www.worldsbk.com/en/calendar

export const worldSuperbikes = async (page) => {
  await page.goto(`https://www.worldsbk.com/en/calendar`, {
    waitUntil: "domcontentloaded",
  });
  const rounds = await page.evaluate(async (ctx) => {
    return document.querySelectorAll("#circuit_calendar > li");
  });
  // const round = rounds.querySelector("a");

  // console.log(round);

  let roundsWithDetail = [];

  for (let i = 0; i < rounds.length; i++) {
    console.log(rounds[0]);
    const link = rounds[0].children[0].href;
    page.goto(link);

    await page.evaluate();
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
  }
  // console.log(rounds);
  // });
};

// Page.$$()
