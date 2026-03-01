const CALENDAR_URL = "https://fimspeedway.com/sgp/calendar";

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function monthFromToken(token = "") {
  const cleaned = cleanText(token).toLowerCase().replace(/\./g, "");
  return MONTHS[cleaned] ?? null;
}

function dateFromParts(year, month, day) {
  if (!year || !month || !day) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatUtcOffset(offsetMinutes = 0) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = pad2(Math.floor(absolute / 60));
  const minutes = pad2(absolute % 60);
  return `${sign}${hours}${minutes}`;
}

function formatOffsetDate(date, {
  hour = 0,
  minute = 0,
  second = 0,
  offsetMinutes = 0,
} = {}) {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${formatUtcOffset(offsetMinutes)}`;
}

function dayLabel(dateTimeText) {
  const localDate = dateTimeText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (localDate) {
    const parsed = new Date(Date.UTC(Number(localDate[1]), Number(localDate[2]) - 1, Number(localDate[3])));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
    }
  }

  const withColon = dateTimeText.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = new Date(withColon);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

function determineType(name = "") {
  const lowered = name.toLowerCase();
  if (/\brace\b|\bracing\b|\bgp\b|\bgrand prix\b|\bsemi-final\b|\bfinal\b/.test(lowered)) return "RACE";
  if (/\bqualifying\b|\bqualifier\b/.test(lowered)) return "QUALIFYING";
  if (/\bpractice\b|\btraining\b/.test(lowered)) return "PRACTICE";
  return "OTHER";
}

function parseTimeZoneOffsetMinutes(timeZoneText = "") {
  const cleaned = cleanText(timeZoneText);
  const match = cleaned.match(/(?:GMT|UTC)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

  return sign * ((hours * 60) + minutes);
}

function parse12HourTime(value = "") {
  const cleaned = cleanText(value);
  const match = cleaned.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return {
    hour,
    minute,
    normalized: `${match[1]}:${match[2]} ${meridiem}`,
  };
}

function parseDateRange(dateText, year) {
  if (!dateText) return { start: null, end: null };

  const normalized = cleanText(dateText)
    .replace(/[–—]/g, "-")
    .replace(/,/g, "")
    .trim();

  const crossMonth = normalized.match(/(\d{1,2})\s+([A-Za-z.]+)\s*-\s*(\d{1,2})\s+([A-Za-z.]+)/);
  if (crossMonth) {
    const start = dateFromParts(year, monthFromToken(crossMonth[2]), Number(crossMonth[1]));
    let end = dateFromParts(year, monthFromToken(crossMonth[4]), Number(crossMonth[3]));
    if (start && end && end < start) {
      end = dateFromParts(year + 1, monthFromToken(crossMonth[4]), Number(crossMonth[3]));
    }
    return { start, end: end ?? start };
  }

  const sameMonth = normalized.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z.]+)/);
  if (sameMonth) {
    const month = monthFromToken(sameMonth[3]);
    const start = dateFromParts(year, month, Number(sameMonth[1]));
    const end = dateFromParts(year, month, Number(sameMonth[2]));
    return { start, end: end ?? start };
  }

  const single = normalized.match(/(\d{1,2})\s+([A-Za-z.]+)/);
  if (single) {
    const start = dateFromParts(year, monthFromToken(single[2]), Number(single[1]));
    return { start, end: start };
  }

  return { start: null, end: null };
}

function normalizeDateLabel(round) {
  if (round.date) return round.date;
  if (!round.startDate) return null;
  const parsed = new Date(`${round.startDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function roundEvents(round, year) {
  let start = null;
  let end = null;

  if (round.startDate) {
    const parsed = new Date(`${round.startDate}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      start = parsed;
      end = parsed;
    }
  }

  if (!start) {
    const parsedRange = parseDateRange(round.date, year);
    start = parsedRange.start;
    end = parsedRange.end || parsedRange.start;
  }

  if (!start) return [];

  const offsetMinutes = parseTimeZoneOffsetMinutes(round.timeZoneText);
  if (Array.isArray(round.sessions) && round.sessions.length > 0) {
    const timedSessions = round.sessions.map((session) => {
      const parsedTime = parse12HourTime(session.time);
      if (!parsedTime) return null;

      const dateTimeStart = formatOffsetDate(start, {
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        second: 0,
        offsetMinutes,
      });

      return {
        dateTimeStart,
        dateTimeEnd: dateTimeStart,
        name: session.name || round.title || "FIM Speedway GP Session",
        type: determineType(session.name || round.title || ""),
        day: dayLabel(dateTimeStart),
      };
    }).filter(Boolean);

    if (timedSessions.length > 0) {
      return timedSessions;
    }
  }

  const dateTimeStart = formatOffsetDate(start, { hour: 0, minute: 0, second: 0, offsetMinutes });
  const dateTimeEnd = formatOffsetDate(end || start, { hour: 23, minute: 59, second: 59, offsetMinutes });
  const name = round.title || "FIM Speedway GP";

  return [{
    dateTimeStart,
    dateTimeEnd,
    name,
    type: determineType(name),
    day: dayLabel(dateTimeStart),
  }];
}

async function scrapeRoundDetails(page, href) {
  if (!href) {
    return {
      timeZoneText: null,
      sessions: [],
    };
  }

  try {
    await page.goto(href, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForSelector("body");
    await page.waitForTimeout(600);

    const details = await page.evaluate(() => {
      const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();
      const rawLines = String(document.body?.innerText || "").split("\n");
      const lines = rawLines.map((line) => clean(line)).filter(Boolean);

      const timeZoneLineIndex = lines.findIndex((line) => /^time zone$/i.test(line));
      let timeZoneText = null;
      if (timeZoneLineIndex >= 0 && lines[timeZoneLineIndex + 1]) {
        const afterLabel = lines[timeZoneLineIndex + 1];
        if (/(?:GMT|UTC)\s*[+-]\s*\d{1,2}(?::?\d{2})?/i.test(afterLabel)) {
          timeZoneText = afterLabel;
        }
      }
      if (!timeZoneText) {
        timeZoneText = lines.find((line) => /(?:GMT|UTC)\s*[+-]\s*\d{1,2}(?::?\d{2})?/i.test(line)) || null;
      }

      const isLikelySessionName = (text) => {
        if (!text) return false;
        if (/\d{1,2}:\d{2}\s*[AP]M/i.test(text)) return false;
        if (text.length > 80) return false;
        if (/^(image|time zone|racing timetable)$/i.test(text)) return false;

        const letters = (text.match(/[A-Za-z]/g) || []).length;
        if (!letters) return false;

        const uppercaseLetters = (text.match(/[A-Z]/g) || []).length;
        const uppercaseRatio = uppercaseLetters / letters;
        if (uppercaseRatio >= 0.6) return true;

        return /\b(qualifying|practice|race|racing|sprint|final|semi)\b/i.test(text);
      };

      const timetableStart = lines.findIndex((line) => /^racing timetable$/i.test(line));
      const sessions = [];
      const seen = new Set();

      if (timetableStart >= 0) {
        const stopRegex = /^(last time in|destination|next events|venue|results|standings|news)$/i;
        for (let i = timetableStart + 1; i < lines.length; i += 1) {
          const line = lines[i];
          if (stopRegex.test(line)) break;

          const timeMatch = line.match(/\b(\d{1,2}:[0-5]\d\s*[AP]M)\b/i);
          if (!timeMatch) continue;

          let sessionName = null;
          for (let j = i - 1; j >= Math.max(timetableStart + 1, i - 8); j -= 1) {
            if (isLikelySessionName(lines[j])) {
              sessionName = lines[j];
              break;
            }
          }

          if (!sessionName) {
            sessionName = "Session";
          }

          const normalizedTime = clean(timeMatch[1].toUpperCase().replace(/\s+/g, " "));
          const key = `${sessionName}|${normalizedTime}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          sessions.push({
            name: sessionName,
            time: normalizedTime,
          });
        }
      }

      return {
        timeZoneText,
        sessions,
      };
    });

    return {
      timeZoneText: details.timeZoneText,
      sessions: Array.isArray(details.sessions) ? details.sessions : [],
    };
  } catch (error) {
    console.warn(`[FIM Speedway] Failed to scrape round details from ${href}: ${error.message}`);
    return {
      timeZoneText: null,
      sessions: [],
    };
  }
}

async function selectDropdownOption(page, selectIndex, optionText) {
  const selected = await page.evaluate(({ selectIndex, optionText }) => {
    const clean = (v = "") => String(v).replace(/\s+/g, " ").trim();
    const selects = Array.from(document.querySelectorAll("select"));
    const select = selects[selectIndex];
    if (!select) return false;

    const target = clean(optionText);
    const option = Array.from(select.options).find((opt) => {
      const text = clean(opt.textContent || "");
      const value = clean(opt.value || "");
      return text === target || value === target;
    });

    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { selectIndex, optionText });

  if (selected) {
    await page.waitForTimeout(800);
  }
}

export const fimSpeedway = async (page, year = String(new Date().getFullYear())) => {
  const targetYear = Number.parseInt(year, 10) || new Date().getFullYear();

  await page.goto(CALENDAR_URL, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("body");
  await page.waitForTimeout(1000);

  // 0: year selector, 1: championship selector
  await selectDropdownOption(page, 0, String(targetYear));
  await selectDropdownOption(page, 1, "SGP");

  const scraped = await page.evaluate(() => {
    const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();
    const monthKey = (token = "") => clean(token).toLowerCase().replace(/\./g, "");
    const monthMap = {
      jan: "01", january: "01",
      feb: "02", february: "02",
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", sept: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12",
    };

    const yearSelect = document.querySelectorAll("select")[0];
    const selectedYearText = clean(yearSelect?.selectedOptions?.[0]?.textContent || "");
    const yearMatch = selectedYearText.match(/\b(20\d{2})\b/);
    const selectedYear = Number(yearMatch?.[1] || new Date().getFullYear());

    const cards = Array.from(document.querySelectorAll("div")).filter((div) => {
      const className = String(div.className || "");
      if (!className.includes("shadow-xl") || !className.includes("bg-dark-gray-1")) return false;
      return Array.from(div.querySelectorAll("a[href]")).some((a) => /event info/i.test(a.textContent || ""));
    });

    const rounds = cards.map((card) => {
      const monthPattern = "(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)";
      const dateRegex = new RegExp(`(?:^|\\b)(\\d{1,2})\\s+${monthPattern}\\.?\\s*(20\\d{2})?`, "i");

      const paragraphs = Array.from(card.querySelectorAll("p")).map((p) => clean(p.textContent || "")).filter(Boolean);
      const infoLink = Array.from(card.querySelectorAll("a[href]")).find((a) => /event info/i.test(a.textContent || ""));

      if (!infoLink) return null;

      const roundLabel = paragraphs.find((text) => /^round\s+\d+/i.test(text)) || null;
      const location = paragraphs.find((text) => /,/.test(text) && !/\d{4}/.test(text)) || null;
      const rawTitle = paragraphs.find((text) => /FIM Speedway GP/i.test(text)) || null;
      const title = clean((rawTitle || [roundLabel, location].filter(Boolean).join(" - ")).replace(/^\d{4}\s+/, ""));

      const dateLine = paragraphs.find((text) => dateRegex.test(text)) || "";
      const dateMatch = dateLine.match(dateRegex);
      const day = dateMatch ? dateMatch[1].padStart(2, "0") : null;
      const month = dateMatch ? monthMap[monthKey(dateMatch[2])] : null;
      const year = dateMatch?.[3] ? Number(dateMatch[3]) : selectedYear;

      const monthLabel = dateMatch ? dateMatch[2].replace(/\./g, "").slice(0, 3) : null;
      const date = day && monthLabel ? `${day} ${monthLabel}` : null;
      const startDate = day && month ? `${year}-${month}-${day}` : null;

      return {
        title: title || "FIM Speedway GP",
        date,
        href: infoLink.href,
        startDate,
      };
    }).filter(Boolean);

    const deduped = [];
    const seen = new Set();
    for (const round of rounds) {
      const key = `${round.href}|${round.title}|${round.date}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(round);
    }

    return {
      year: selectedYear,
      rounds: deduped,
    };
  });

  const roundsWithDetails = [];
  for (const round of scraped.rounds) {
    const details = await scrapeRoundDetails(page, round.href);
    roundsWithDetails.push({
      ...round,
      timeZoneText: details.timeZoneText,
      sessions: details.sessions,
    });
  }

  const finalYear = scraped.year || targetYear;
  const data = roundsWithDetails.map((round) => ({
    title: round.title,
    date: normalizeDateLabel(round),
    href: round.href,
    data: roundEvents(round, finalYear),
  }));

  return {
    name: "FIM Speedway",
    year: finalYear,
    data,
  };
};
