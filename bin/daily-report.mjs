#!/usr/bin/env node
/**
 * Yesterday's support tickets grouped by theme, plus how yesterday compares
 * with the 7 days before it. Run it once each morning.
 *
 * Counts UNIQUE people per theme ("10 people reported X"), not raw tickets,
 * so one chatty customer does not inflate an issue. "Yesterday" is the
 * previous calendar day at REPORT_UTC_OFFSET hours (default 0; 5.5 = IST).
 *
 * Output is ready-to-post plain text in three sections:
 *   main report            → safe for a team channel
 *   ---PATTERN---          → safe for a team channel
 *   ---OTHER---            → raw uncategorised snippets, emails stripped.
 *                            For the agent to read and summarise. NEVER post
 *                            this section as-is.
 *
 * Themes are cached per ticket in data/theme-cache.json, so each ticket's
 * comments are fetched once, not every morning.
 */

import { classify, themeTitle } from '../lib/themes.mjs';
import { sanitizeQuote } from '../lib/sanitize.mjs';
import { readState, writeState } from '../lib/state.mjs';
import { customerText, pool, searchTickets, zendeskConfig } from '../lib/zendesk.mjs';

const OFFSET_MS = Number(process.env.REPORT_UTC_OFFSET || 0) * 3_600_000;
const DAY_MS = 86_400_000;

// Yesterday [00:00, 24:00) in local time, as UTC instants.
const localNow = new Date(Date.now() + OFFSET_MS);
const startLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - 1);
const start = startLocal - OFFSET_MS;
const end = start + DAY_MS;
const historyStart = start - 7 * DAY_MS;
const label = new Date(startLocal).toISOString().slice(0, 10);

const config = zendeskConfig();
const tickets = (await searchTickets(config, `created>=${new Date(historyStart).toISOString().slice(0, 19)}Z`, 5000))
  .filter((t) => Date.parse(t.created_at) < end);

const cache = await readState('theme-cache.json');
const snippets = new Map();
await pool(tickets, 5, async (t) => {
  if (cache[t.id] && Date.parse(t.created_at) < start) return;
  const text = await customerText(config, t);
  const body = text.replace(t.subject || '', '').trim();
  cache[t.id] = body.length < 5 ? 'silent' : classify(text);
  if (cache[t.id] === 'other') snippets.set(t.id, sanitizeQuote(text, 220));
});
// Only this 8-day window matters; drop older ids so the file stays small.
const keep = new Set(tickets.map((t) => String(t.id)));
for (const id of Object.keys(cache)) if (!keep.has(id)) delete cache[id];
await writeState('theme-cache.json', cache);

const yesterday = tickets.filter((t) => Date.parse(t.created_at) >= start);
if (yesterday.length === 0) {
  console.log(`*Support report for ${label}:* no new tickets came in yesterday.`);
  process.exit(0);
}

const people = (n) => (n === 1 ? '1 person' : `${n} people`);
const byTheme = new Map();
for (const t of yesterday) {
  const theme = cache[t.id];
  if (!byTheme.has(theme)) byTheme.set(theme, new Set());
  byTheme.get(theme).add(t.requester_id ?? t.id);
}
const ranked = [...byTheme]
  .map(([theme, set]) => ({ theme, count: set.size }))
  .sort((a, b) => (a.theme === 'silent') - (b.theme === 'silent') || b.count - a.count);

console.log(`*Support report for ${label}* (${yesterday.length} tickets):\n`);
ranked.forEach(({ theme, count }, i) => console.log(`${i + 1}. ${people(count)} reported: ${themeTitle(theme)}`));

// Per-day unique people per theme over the 7 days before yesterday.
// Day index 0..6, where 6 = the day before yesterday.
const daily = new Map();
for (const t of tickets) {
  const created = Date.parse(t.created_at);
  if (created >= start) continue;
  const day = Math.floor((created - historyStart) / DAY_MS);
  const theme = cache[t.id];
  if (!daily.has(theme)) daily.set(theme, new Map());
  const perDay = daily.get(theme);
  if (!perDay.has(day)) perDay.set(day, new Set());
  perDay.get(day).add(t.requester_id ?? t.id);
}

const patterns = [];
for (const { theme, count } of ranked) {
  if (theme === 'silent') continue;
  const perDay = daily.get(theme);
  const daysSeen = perDay?.size ?? 0;
  const weekTotal = perDay ? [...perDay.values()].reduce((n, s) => n + s.size, 0) : 0;
  const prevDay = perDay?.get(6)?.size ?? 0;
  const title = themeTitle(theme);
  if (daysSeen === 0) patterns.push(`New: ${title} — first time this week (${count} yesterday).`);
  else if (count >= prevDay * 2 && count >= 3) patterns.push(`Up: ${title} — ${count} yesterday, ${prevDay} the day before.`);
  else if (prevDay >= 3 && count * 2 <= prevDay) patterns.push(`Down: ${title} — ${prevDay} the day before, ${count} yesterday.`);
  else if (daysSeen >= 4) patterns.push(`Keeps coming back: ${title} — ${daysSeen} of the last 7 days, ${weekTotal} people that week, ${count} yesterday.`);
}
for (const [theme, perDay] of daily) {
  const prevDay = perDay.get(6)?.size ?? 0;
  if (theme !== 'silent' && prevDay >= 3 && !byTheme.has(theme)) {
    patterns.push(`Stopped: ${themeTitle(theme)} — ${prevDay} the day before, none yesterday.`);
  }
}

console.log('---PATTERN---');
if (patterns.length === 0) console.log('*Against the last 7 days:* no new themes, no rises, no drops.');
else {
  console.log('*Against the last 7 days:*');
  patterns.forEach((line, i) => console.log(`${i + 1}. ${line}`));
}

console.log('---OTHER---');
const other = yesterday.filter((t) => snippets.has(t.id));
if (other.length === 0) console.log('(none)');
other.forEach((t, i) => console.log(`${i + 1}. [ticket ${t.id}] ${snippets.get(t.id)}`));
