
export const wsbk = async (page) => {
    await page.goto(`https://www.worldsbk.com/en/calendar`, {
      waitUntil: "domcontentloaded",
    });
  
    const rounds = await page.evaluate(() => {
      const events = document.querySelectorAll('a.track-link');
  
      const formattedRoundDetails = [...events].map((round) => {
        const title = round.querySelector('h2')?.innerText.trim();
        const date = round.querySelector('.date')?.innerText.trim();

        const href = round.href;
        return {
            title,
            date,
            href
        };
      });
  
      return formattedRoundDetails;
    });

  
    const detailedRounds = [];
  
    // for (let i = 0; i < rounds.length; i++) {
    for (let i = 0; i < 1; i++) {
      const round = rounds[i];
      await page.goto(`${round.href}#schedule`, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForSelector('.days-tabs')

      const data = await page.evaluate(async () => {
        function waitFor(delay) {
          return new Promise(resolve => setTimeout(resolve, delay));
      }

        const pageData = [];
        const tabs = document.querySelector('.days-tabs')?.children;

        for (let j = 0; j < tabs.length; j++) {
          const tab = tabs[j];
          tab.click();
          await waitFor(100);

          const day = tab?.innerText.replace(/\n/g, " ");
          const items = document.querySelectorAll('.timeIso');


          pageData.push([...items].map((item) => {

            return {
              day,
              dateTimeStart: item.children[0]?.getAttribute("data_ini"),
              dateTimeEnd: item.children[1]?.getAttribute("data_ini"),
              name: item.children[2]?.innerText.trim()
            }
            }))
        }
        return pageData
      });

      const vals = {
        ...round,
        data,
      };
  
      detailedRounds.push(vals);
    }
  
    return {
      name: "WorldSBK",
      year: 2024,
      data: detailedRounds,
    };
  };
  

