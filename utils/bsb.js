export const britishSuperBikes = async (page, year) => {
  await page.goto(`https://www.britishsuperbike.com/calendar/${year}`, {
    waitUntil: "domcontentloaded",
  });

  const rounds = await page.evaluate(() => {
    const roundLinks = document.querySelectorAll(".card");

    const formattedRoundDetails = [...roundLinks].map((round) => {
      const aTag = round.children[0];
      const href = aTag.href;
      const eventType = aTag.querySelector(".card-divider > .header").innerText;
      const eventTags = aTag.querySelector(
        ".card-divider > .grid-x .details"
      ).childNodes;

      return {
        href,
        eventType,
        date: eventTags[0].innerText,
        title: eventTags[1].innerText,
        type: eventTags[2].innerText,
      };
    });

    return formattedRoundDetails;
  });

  const detailedRounds = [];

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    await page.goto(round.href, {
      waitUntil: "domcontentloaded",
    });

    const data = await page.evaluate(() => {
      const timings =
        document.querySelector(".schedule").childNodes[0].children;

      console.log(timings);
      const times = [...timings].map((time) => {
        const elem = time.children[0].children;

        return {
          day: elem[0].childNodes[0].innerText,
          name: elem[1].childNodes[0].innerText,
          time: elem[2].childNodes[0].innerText,
        };
      });

      return times;
    });

    const vals = {
      ...round,
      data,
    };

    detailedRounds.push(vals);
  }

  return {
    name: "British Superbikes",
    year,
    data: detailedRounds,
  };
};
