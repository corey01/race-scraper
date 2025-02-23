export const wsbk = async (page) => {
  console.log("Starting WSBK");
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

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    await page.goto(`${round.href}#schedule`, {
      waitUntil: "domcontentloaded",
    });

    await page.waitForSelector('.days-tabs');

    const data = await page.evaluate(async () => {
      function waitFor(delay) {
        return new Promise(resolve => setTimeout(resolve, delay));
      }

      function determineType(name) {
        if (name.includes("Race") || name.includes("Superpole Race")) {
          return "RACE";
        } else if (name.includes("WUP")) {
          return "WARMUP";
        } else if (name.includes("FP")) {
          return "PRACTICE";
        } else {
          return "OTHER";
        }
      }

      const pageData = [];
      const tabs = document.querySelectorAll('.days-tabs .tab');

      for (let j = 0; j < tabs.length; j++) {
        const tab = tabs[j];
        tab.click();
        await waitFor(200); // Increased wait time

        const day = tab.innerText.trim();
        const dayContent = document.querySelector(`#day_${j}`);
        
        if (dayContent && !dayContent.classList.contains('hidden')) {
          const items = dayContent.querySelectorAll('.timeIso');
          
          pageData.push({
            day,
            events: [...items].map((item) => {
              const name = item.children[2]?.innerText.trim()
                .replace(/\n/g, " ")
                .replace(/(Live Video|Video|Report|Results)/gi, "")
                .trim();
              
              return {
                dateTimeStart: item.children[0]?.getAttribute("data_ini"),
                dateTimeEnd: item.children[1]?.getAttribute("data_end"),
                name,
                type: determineType(name)
              };
            })
          });
        }
      }
      return pageData;
    });

    const isWsbk = (event) => event.name.includes("WorldSBK");

    // Function to check if an event is a duplicate
    function isDuplicate(event, existingEvents) {
      return existingEvents.some(existingEvent =>
        existingEvent.dateTimeStart === event.dateTimeStart &&
        existingEvent.name === event.name
      );
    }

    // Function to process data and remove duplicates
    function processData(data) {
      const uniqueEvents = [];
      data.forEach(dayEvents => {
        dayEvents.events.forEach(event => {
          if (!isDuplicate(event, uniqueEvents)) {
            uniqueEvents.push({
              ...event,
              day: dayEvents.day
            });
          }
        });
      });
      return uniqueEvents;
    }

    const processedData = processData(data);

    const vals = {
      ...round,
      data: processedData,
    };

    detailedRounds.push(vals);
  }

  console.log("Done WSBK, length: ", detailedRounds);

  return {
    name: "WorldSBK",
    year: 2025,
    data: detailedRounds,
  };
};


