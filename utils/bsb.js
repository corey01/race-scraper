// utils/bsb.js
// Puppeteer v21+
// Scrapes BSB calendar + event timetable and emits FULL ISO datetimes.
// Works when called with EITHER a Browser or a Page.
// Requires: npm i luxon

import { DateTime } from "luxon";

const NAV_TIMEOUT = 45_000;
const SEL_TIMEOUT = 20_000;
const MAX_CONCURRENCY = 4; // be polite
const ROOT = "https://www.britishsuperbike.com";

const timeRx = /\b([01]?\d|2[0-3]):[0-5]\d\b/; // 0:00-23:59
const dayRx = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i;
const noiseRx = /\b(Live\s*Video|Video|Results?)\b/gi;

function clean(s = "") {
  return s.replace(/\s+/g, " ").replace(noiseRx, "").trim();
}

function determineType(name = "") {
  const n = name.toLowerCase();
  if (/\brace\b|\brace\s*\d\b|\bsprint\b/.test(n)) return "RACE";
  if (/\bwarm[\s-]*up\b|^wup$/.test(n)) return "WARMUP";
  if (/\b(fp\d?|free practice)\b/.test(n)) return "PRACTICE";
  if (/\b(q\d|qualifying|superpole)\b/.test(n)) return "QUALIFYING";
  if (/\bgates open\b/.test(n)) return "GATES";
  return "OTHER";
}

async function withRetry(fn, { tries = 3, baseDelay = 600 } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      err = e;
      if (i === tries - 1) break;
      await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw err;
}

async function hardGoto(page, url) {
  return withRetry(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  });
}

async function waitForVisible(page, selector) {
  await page.waitForSelector(selector, { timeout: SEL_TIMEOUT });
}

/** ---- Date span → concrete dates (Luxon) ----
 * Handles:
 *  "23 - 25 Aug", "23–25 Aug", "30 Aug - 1 Sep", "25 Aug"
 */
function expandDateSpan(spanText, year, defaultZone) {
  if (!spanText) return [];
  const txt = spanText.replace(/\u2013|\u2014/g, "-"); // en-/em-dash → hyphen
  const m = txt.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)/);
  const mCross = txt.match(/(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)/);

  let start, end;
  if (mCross) {
    const [, d1, mon1, d2, mon2] = mCross;
    start = DateTime.fromFormat(`${d1} ${mon1} ${year}`, "d LLL yyyy", { zone: defaultZone });
    end   = DateTime.fromFormat(`${d2} ${mon2} ${year}`, "d LLL yyyy", { zone: defaultZone });
  } else if (m) {
    const [, d1, d2, mon] = m;
    start = DateTime.fromFormat(`${d1} ${mon} ${year}`, "d LLL yyyy", { zone: defaultZone });
    end   = DateTime.fromFormat(`${d2} ${mon} ${year}`, "d LLL yyyy", { zone: defaultZone });
  } else {
    const s = txt.match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (s) {
      start = DateTime.fromFormat(`${s[1]} ${s[2]} ${year}`, "d LLL yyyy", { zone: defaultZone });
      end   = start;
    } else return [];
  }
  if (!start.isValid || !end.isValid) return [];
  if (end < start) end = end.plus({ years: 1 });

  const days = [];
  for (let d = start; d <= end; d = d.plus({ days: 1 })) days.push(d);
  return days;
}

// Venue → IANA timezone (extend if needed)
function inferTimezone(circuitText = "") {
  if (/Assen/i.test(circuitText)) return "Europe/Amsterdam";
  return "Europe/London";
}

function resolveEventDateISO({ day, time }, round) {
  if (!day || !time || !round?.date || !round?.year) return { iso: null, zone: null };

  const zone = inferTimezone(round.circuit || round.eventTitle || "");
  const days = expandDateSpan(round.date, round.year, zone);
  if (!days.length) return { iso: null, zone };

  const targetDow = DateTime.fromFormat(day, "ccc", { zone }).weekday; // 1=Mon..7=Sun
  const match = days.find(d => d.weekday === targetDow);
  if (!match) return { iso: null, zone };

  const [hh, mm] = time.split(":").map(Number);
  const dt = DateTime.fromObject(
    { year: match.year, month: match.month, day: match.day, hour: hh, minute: mm, second: 0 },
    { zone }
  );
  return { iso: dt.isValid ? dt.toISO() : null, zone };
}

/** -------- SCRAPERS -------- */

async function scrapeCalendar(page) {
  await hardGoto(page, `${ROOT}/calendar`);
  await waitForVisible(page, "body");

  // Find "Event Details" anchors and read nearby card text
  const rounds = await page.evaluate(() => {
    const toText = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

    const links = Array.from(document.querySelectorAll('a'))
      .filter(a => /Event Details/i.test(a.textContent || ""))
      .map(a => new URL(a.getAttribute("href") || "", location.origin).toString());

    const hrefs = Array.from(new Set(links));

    const cards = hrefs.map(href => {
      const a = Array.from(document.querySelectorAll('a'))
        .find(x => new URL(x.getAttribute("href") || "", location.origin).toString() === href);

      let container = a;
      for (let i = 0; i < 4 && container; i++) {
        if (container.matches && container.matches('article,li,div,section')) break;
        container = container?.parentElement;
      }
      const bucket = container || a?.parentElement || document.body;

      const textNodes = Array.from(bucket.querySelectorAll('*'))
        .slice(0, 50)
        .map(el => (el.tagName === 'A' ? '' : toText(el)))
        .filter(Boolean);

      let round = null, date = null, circuit = null, layout = null;

      for (const t of textNodes) {
        if (/^Round\s+\d+/i.test(t)) round = t;
        else if (/\d{1,2}\s*-\s*\d{1,2}\s+[A-Za-z]+/.test(t)
              || /\d{1,2}\s+[A-Za-z]+\s*-\s*\d{1,2}\s+[A-Za-z]+/.test(t)
              || /\d{1,2}\s+[A-Za-z]+/.test(t)) date = t;
        else if (!circuit && /Park|Hatch|Snetterton|Thruxton|Assen|Knockhill|Navarra|Donington|Oulton/i.test(t)) circuit = t;
        else if (!layout && /\b(GP|International|Full|National|Main Track)\b/i.test(t)) layout = t;
      }

      return { title: round || null, date: date || null, circuit: circuit || null, layout: layout || null, href };
    });

    // Try to capture the year from a nearby heading; otherwise current year
    let year = new Date().getFullYear();
    const h = document.querySelector('h1,h2')?.textContent || "";
    const m = h.match(/\b(20\d{2})\b/);
    if (m) year = Number(m[1]);

    return { year, rounds: cards };
  });

  // Attach year into each round
  const withYear = rounds.rounds.map(r => ({ ...r, year: rounds.year }));
  return { year: rounds.year, rounds: withYear };
}

async function scrapeEvent(page, round) {
  const url = round.href.replace(/#.*$/, "");
  await hardGoto(page, url);
  await waitForVisible(page, "body");

  // Extract timetable (day / name / time)
  const rawEvents = await page.evaluate(({ timeRxSource, dayRxSource }) => {
    const timeRx = new RegExp(timeRxSource);
    const dayRx  = new RegExp(dayRxSource, "i");
    const pageEvents = [];

    // A) Structured lists/tables first
    const structured = Array.from(document.querySelectorAll(
      '.event-schedule .event, .event-schedule li, .schedule li, .schedule .row, .timetable li, .timetable .row'
    ));
    if (structured.length) {
      for (const el of structured) {
        const txts = Array.from(el.querySelectorAll('*')).map(n => (n.textContent || "").trim()).filter(Boolean);
        const time = (txts.join(" ").match(timeRx) || [])[0] || null;
        let day = null;
        for (const t of txts) { if (dayRx.test(t)) { day = t; break; } }
        // Only use the first non-day/non-time text as the name
        const name = txts.find(t => !dayRx.test(t) && !timeRx.test(t)) || "";
        if (time && name) pageEvents.push({ day, name: name.trim(), time });
      }
    }

    // B) Heuristic fallback
    if (!pageEvents.length) {
      const nodes = Array.from(document.querySelectorAll('body *'))
        .filter(el => !el.children.length && (el.textContent || '').trim());
      for (let i = 0; i < nodes.length; i++) {
        const t = (nodes[i].textContent || "").trim();
        if (!timeRx.test(t)) continue;
        const time = (t.match(timeRx) || [])[0];
        const win = nodes.slice(Math.max(0, i - 4), Math.min(nodes.length, i + 6));
        let day = null;
        for (const n of win) {
          const s = (n.textContent || "").trim();
          if (dayRx.test(s)) { day = s; break; }
        }
        const near = win.map(n => (n.textContent || "").trim()).join(" ").replace(/\s+/g, " ");
        const name = near.replace(new RegExp(timeRx.source, "g"), "").replace(new RegExp(dayRx.source, "ig"), "").replace(/\s+/g, " ").trim();
        if (time && name && name.length <= 150) pageEvents.push({ day, name, time });
      }
    }

    // Normalize + de‑dupe
    const seen = new Set();
    const out = [];
    for (const ev of pageEvents) {
      const d = ev.day ? ev.day.trim() : null;
      const nm = ev.name.replace(/\b(Live\s*Video|Video|Results?)\b/gi, "").replace(/\s{2,}/g, " ").trim();
      const tm = ev.time;
      const key = `${d || ""}|${nm}|${tm}`;
      if (nm && tm && !seen.has(key)) {
        seen.add(key);
        out.push({ day: d, name: nm, time: tm });
      }
    }
    return out;
  }, { timeRxSource: timeRx.source, dayRxSource: dayRx.source });

  // Title/circuit/layout (best-effort)
  const meta = await page.evaluate(() => {
    const pick = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
    const title = pick('h1, .event-title, .hero h1');
    const chunks = Array.from(document.querySelectorAll('h1, h2, .hero *'))
      .map(e => (e.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const circuit = chunks.find(t => /Park|Hatch|Snetterton|Thruxton|Assen|Knockhill|Navarra|Donington|Oulton/i.test(t)) || null;
    const layout = chunks.find(t => /\b(GP|International|Full|National|Main Track)\b/i.test(t)) || null;
    return { title, circuit, layout };
  });

  // Resolve to full ISO datetimes with timezone
  const events = rawEvents.map(e => {
    const { iso, zone } = resolveEventDateISO(e, { ...round, eventTitle: meta.title });
    return {
      ...e,
      type: determineType(e.name),
      dateTimeStart: iso,   // e.g. "2025-08-25T09:40:00.000+01:00"
      tz: zone,             // e.g. "Europe/London"
    };
  });

  return {
    ...round,
    eventTitle: meta.title || null,
    circuit: round.circuit ?? meta.circuit ?? null,
    layout: round.layout ?? meta.layout ?? null,
    url,
    data: events,
  };
}

/** Normalize ctx so we can accept either a Browser or a Page */
async function getBrowserAndPrimaryPage(ctx) {
  // Browser (has newPage and no goto)
  if (ctx && typeof ctx.newPage === "function" && typeof ctx.goto !== "function") {
    const browser = ctx;
    const page = await browser.newPage();
    return { browser, page, createdPrimary: true };
  }
  // Page (has goto)
  if (ctx && typeof ctx.goto === "function") {
    const page = ctx;
    const browser = page.browser && page.browser();
    return { browser, page, createdPrimary: false };
  }
  throw new Error("bsb() expected a Puppeteer Browser or Page");
}

export const bsb = async (ctx) => {
  const { browser, page, createdPrimary } = await getBrowserAndPrimaryPage(ctx);

  // Speed: block heavy assets on the primary page
  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const t = req.resourceType();
      if (t === "image" || t === "font" || t === "media" || t === "stylesheet") req.abort();
      else req.continue();
    });
  } catch {}

  const { year, rounds } = await scrapeCalendar(page);

  // Concurrency across multiple tabs if Browser is available; otherwise serial on the same Page
  const results = new Array(rounds.length);
  let idx = 0;
  const workerCount = browser ? Math.min(MAX_CONCURRENCY, rounds.length) : 1;

  const workers = Array.from({ length: workerCount }, async () => {
    const p = browser ? await browser.newPage() : null;
    const workerPage = p || page;

    if (p) {
      try {
        await p.setRequestInterception(true);
        p.on("request", (req) => {
          const t = req.resourceType();
          if (t === "image" || t === "font" || t === "media" || t === "stylesheet") req.abort();
          else req.continue();
        });
      } catch {}
    }

    while (true) {
      const i = idx++;
      if (i >= rounds.length) break;
      const round = rounds[i];
      try {
        const enrichedRound = { ...round, year }; // ensure round carries year
        const r = await withRetry(() => scrapeEvent(workerPage, enrichedRound), { tries: 3, baseDelay: 700 });
        results[i] = r;
        console.log(`[BSB] Scraped: ${round.title || round.circuit} (${round.date || ""})`);
      } catch (e) {
        console.warn(`[BSB] Failed ${round.href}: ${e?.message || e}`);
        results[i] = { ...round, url: round.href, data: [], error: true };
      }
    }

    if (p) await p.close();
  });

  await Promise.all(workers);

  if (createdPrimary) await page.close(); // we opened it here

  return {
    name: "BSB",
    year,
    scrapedAt: new Date().toISOString(),
    source: `${ROOT}/calendar`,
    data: results.filter(Boolean),
  };
};
