const F1_SITE = "https://www.formula1.com";
const F1_API_BASE = "https://api.formula1.com";
const FALLBACK_BROADCAST_API_KEY = "BQ1SiSmLUOsp460VzXBlLrh689kGgYEZ";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toWsbkOffsetDateTime(localIsoDateTime, gmtOffset = "+00:00") {
  if (!localIsoDateTime) return "";
  const compactOffset = String(gmtOffset).replace(":", "");
  return `${localIsoDateTime}${compactOffset}`;
}

function dayFromLocalDateTime(localIsoDateTime) {
  if (!localIsoDateTime) return null;

  try {
    const [year, month, day] = localIsoDateTime.split("T")[0].split("-").map(Number);
    const normalizedDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(normalizedDate.getTime())) return null;

    return normalizedDate.toLocaleDateString("en-GB", {
      weekday: "long",
      timeZone: "UTC",
    });
  } catch {
    return null;
  }
}

function roundDateLabel(meetingStartDate, meetingEndDate) {
  const start = meetingStartDate?.split("T")?.[0];
  const end = meetingEndDate?.split("T")?.[0];
  if (!start) return null;

  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = (end || start).split("-").map(Number);

  const startDate = new Date(Date.UTC(sy, sm - 1, sd));
  const endDate = new Date(Date.UTC(ey, em - 1, ed));

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

  const startDay = pad2(startDate.getUTCDate());
  const endDay = pad2(endDate.getUTCDate());
  const startMonth = startDate.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const endMonth = endDate.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

  if (start === end) return `${startDay} ${startMonth}`;
  if (startMonth === endMonth) return `${startDay} - ${endDay} ${endMonth}`;
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

function inferSessionKind(timetable = {}) {
  const sessionCode = String(timetable.session || "").toLowerCase();
  const text = `${timetable.sessionType || ""} ${timetable.shortName || ""} ${timetable.description || ""}`.toLowerCase();

  if (sessionCode === "r" || sessionCode === "s") {
    return "RACE";
  }
  if (sessionCode.startsWith("p") || /\bpractice\b/.test(text) || /\bfp\d\b/.test(text)) {
    return "PRACTICE";
  }
  if (sessionCode === "q" || sessionCode === "ss" || /\bqualif/.test(text) || /\bshootout\b/.test(text)) {
    return "QUALIFYING";
  }
  if (/\brace\b/.test(text) || (/\bsprint\b/.test(text) && !/\bshootout\b/.test(text) && !/\bqualif/.test(text))) {
    return "RACE";
  }
  return "OTHER";
}

function mapTypeFromSessionKind(sessionKind) {
  if (sessionKind === "RACE") return "RACE";
  if (sessionKind === "PRACTICE") return "PRACTICE";
  return "OTHER";
}

function extractPublicApiKeyFromHtml(html) {
  if (!html) return null;

  const normalizeKey = (value = "") => {
    const cleaned = String(value).replace(/\\+/g, "").trim();
    const match = cleaned.match(/[A-Za-z0-9]{20,}/);
    return match ? match[0] : null;
  };

  const escapedMatch = html.match(/NEXT_PUBLIC_GLOBAL_BROADCAST_APIKEY\\":\\"([^"]+)/);
  if (escapedMatch?.[1]) {
    const key = normalizeKey(escapedMatch[1]);
    if (key) return key;
  }

  const plainMatch = html.match(/NEXT_PUBLIC_GLOBAL_BROADCAST_APIKEY":"([^"]+)/);
  if (plainMatch?.[1]) {
    const key = normalizeKey(plainMatch[1]);
    if (key) return key;
  }

  return null;
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`F1 API request failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return response.json();
}

export const formula1 = async (page, year = String(new Date().getFullYear())) => {
  const targetYear = String(year);

  await page.goto(`${F1_SITE}/en/racing/${targetYear}`, {
    waitUntil: "domcontentloaded",
  });

  const pageHtml = await page.content();
  const publicApiKey = extractPublicApiKeyFromHtml(pageHtml) || FALLBACK_BROADCAST_API_KEY;

  const headers = {
    apikey: publicApiKey,
    locale: "en",
    referer: `${F1_SITE}/`,
  };

  const eventListing = await fetchJson(
    `${F1_API_BASE}/v1/editorial-eventlisting/events?year=${targetYear}`,
    headers
  );

  const raceMeetings = (eventListing.events || []).filter(
    (event) => event && event.type === "race" && !event.isTestEvent && event.meetingKey
  );

  const detailedRounds = [];

  for (const meeting of raceMeetings) {
    let timetables = [];
    try {
      const meetingData = await fetchJson(
        `${F1_API_BASE}/v1/event-tracker/meeting/${meeting.meetingKey}`,
        {
          ...headers,
          "content-type": "application/json",
        }
      );
      timetables = meetingData?.meetingContext?.timetables || [];
    } catch (err) {
      console.warn(`[F1] Failed to fetch meeting ${meeting.meetingKey}: ${err?.message || err}`);
    }

    const data = timetables.map((session) => {
      const sessionKind = inferSessionKind(session);
      const sessionLabel = session.shortName || session.description || session.session || "Session";
      const dateTimeStart = toWsbkOffsetDateTime(session.startTime, session.gmtOffset);
      const dateTimeEnd = toWsbkOffsetDateTime(session.endTime, session.gmtOffset);

      return {
        dateTimeStart,
        dateTimeEnd,
        name: `Formula 1 - ${sessionLabel}`,
        type: mapTypeFromSessionKind(sessionKind),
        day: dayFromLocalDateTime(session.startTime),
      };
    });

    detailedRounds.push({
      title: meeting.meetingName || meeting.meetingOfficialName || "Grand Prix",
      date: roundDateLabel(meeting.meetingStartDate, meeting.meetingEndDate),
      href: `${F1_SITE}${meeting.url || ""}`,
      data,
    });
  }

  return {
    name: "Formula 1",
    year: Number(eventListing.year || targetYear),
    data: detailedRounds,
  };
};
