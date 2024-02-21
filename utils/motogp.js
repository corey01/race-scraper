
export const motogp = async (page) => {
    await page.goto(`https://www.motogp.com/en/calendar`, {
      waitUntil: "domcontentloaded",
    });
  
    const rounds = await page.evaluate(() => {
      const events = document.querySelectorAll('.calendar-listing__event-container');
  
      const formattedRoundDetails = [...events].map((round) => {
        const type = round.querySelector('.calendar-listing__status-type')?.innerText.trim();
        const title = round.querySelector('.calendar-listing__title')?.innerText.trim();
        const trackName = round.querySelector('.calendar-listing__location-track-name')?.innerText.trim();
        const startDay = round.querySelector('.calendar-listing__date-start-day')?.innerText.trim();
        const startMonth = round.querySelector('.calendar-listing__date-start-month')?.innerText.trim();
        
        const endDay = round.querySelector('.calendar-listing__date-end-day')?.innerText.trim();
        const endMonth = round.querySelector('.calendar-listing__date-end-month')?.innerText.trim();

        const href = round.querySelector('a').href;
        return {
            type,
            title,
            trackName,
            startDay,
            startMonth,
            endDay,
            endMonth,
            href
        };
      });
  
      return formattedRoundDetails;
    });

    const nonTestRounds = rounds.filter((round) => round.type !== 'Test');

  
    const detailedRounds = [];
  
    for (let i = 0; i < nonTestRounds.length; i++) {
      const round = nonTestRounds[i];
      await page.goto(round.href, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForSelector('.event-schedule__tab-list')

      const data = await page.evaluate(async () => {
        function waitFor(delay) {
          return new Promise(resolve => setTimeout(resolve, delay));
      }

        const pageData = [];
        const tabs = document.querySelectorAll('.event-schedule__tab-list-item')

        for (let j = 0; j < tabs.length; j++) {
          const tab = tabs[j];
          tab.click();
          await waitFor(100);

          const date = tab?.innerText.replace(/\n/g, " ");
          const items = document.querySelectorAll('.event-schedule__content-item');

          pageData.push([...items].map((item) => ({
            date,
            time: item.querySelector(".event-schedule__content-time")?.innerText.trim(),
            category: item.querySelector(".event-schedule__content-category")?.innerText.trim(),
            name: item.querySelector(".event-schedule__content-name")?.innerText.trim()
          })))
        }
        return pageData
      });
  
      const vals = {
        ...round,
        data,
      };
  
      detailedRounds.push(vals);
    }

    console.log(detailedRounds)
  
    return {
      name: "MotoGP",
      year: 2024,
      data: detailedRounds,
    };
  };
  

