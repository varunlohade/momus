#!/usr/bin/env node
/**
 * Support surge detector. Run it hourly.
 *
 * Pulls tickets UPDATED in the last SURGE_WINDOW_MIN minutes straight from
 * Zendesk, buckets what each customer said into themes (lib/themes.mjs), and
 * reports any theme that SURGE_DISTINCT_USERS or more different people hit.
 * Updated, not created: chat transcripts land on a ticket only when the chat
 * ends, so an hours-old ticket may get its text now.
 *
 * Also flags a volume surge: tickets created in the window vs the average
 * hourly rate over the past 14 days.
 *
 * Prints JSON: { alerts: [...], themeCounts, freshCount, baselinePerHour }.
 * NEVER posts anywhere — the agent decides and posts. Each alert cools down
 * for SURGE_COOLDOWN_MIN so one incident does not re-alert every hour.
 */

import { classify, themeTitle } from '../lib/themes.mjs';
import { readState, writeState } from '../lib/state.mjs';
import { customerText, pool, searchTickets, zendeskConfig } from '../lib/zendesk.mjs';

const WINDOW_MIN = Number(process.env.SURGE_WINDOW_MIN || 120);
const DISTINCT_USERS = Number(process.env.SURGE_DISTINCT_USERS || 5);
const VOLUME_MULT = Number(process.env.SURGE_VOLUME_MULT || 3);
const COOLDOWN_MIN = Number(process.env.SURGE_COOLDOWN_MIN || 360);

const config = zendeskConfig();
const now = Date.now();
const since = new Date(now - WINDOW_MIN * 60_000);
const iso = (d) => d.toISOString().slice(0, 19) + 'Z';

const [tickets, weekTickets, state] = await Promise.all([
  searchTickets(config, `updated>=${iso(since)}`, 400),
  searchTickets(config, `created>=${iso(new Date(now - 14 * 86_400_000))}`, 5000).catch(() => null),
  readState('surge-state.json', { lastAlert: {} }),
]);

// Distinct requesters per theme.
const byTheme = new Map();
await pool(tickets, 5, async (t) => {
  const theme = classify(await customerText(config, t));
  if (theme === 'other') return;
  if (!byTheme.has(theme)) byTheme.set(theme, new Set());
  byTheme.get(theme).add(t.requester_id);
});

const alerts = [];
const cooldownMs = COOLDOWN_MIN * 60_000;
for (const [theme, users] of byTheme) {
  if (users.size < DISTINCT_USERS) continue;
  if (now - (state.lastAlert[theme] || 0) < cooldownMs) continue;
  alerts.push({ kind: 'theme', theme, title: themeTitle(theme), users: users.size, windowMin: WINDOW_MIN });
  state.lastAlert[theme] = now;
}

// Volume surge. Count only tickets CREATED in the window — the fetch is
// update-based. Skip when the baseline is too small to mean anything.
const createdInWindow = tickets.filter((t) => Date.parse(t.created_at) >= since.getTime()).length;
const baseline = weekTickets ? weekTickets.length / (14 * 24) : null;
if (baseline && baseline >= 0.5) {
  const perHourNow = createdInWindow / (WINDOW_MIN / 60);
  if (perHourNow >= baseline * VOLUME_MULT && perHourNow - baseline >= 4
      && now - (state.lastAlert.__volume__ || 0) >= cooldownMs) {
    alerts.push({
      kind: 'volume',
      perHourNow: Math.round(perHourNow * 10) / 10,
      baselinePerHour: Math.round(baseline * 10) / 10,
    });
    state.lastAlert.__volume__ = now;
  }
}

await writeState('surge-state.json', state);
console.log(JSON.stringify({
  checkedAt: new Date(now).toISOString(),
  windowMin: WINDOW_MIN,
  freshCount: createdInWindow,
  updatedInWindow: tickets.length,
  baselinePerHour: baseline && Math.round(baseline * 10) / 10,
  themeCounts: Object.fromEntries([...byTheme].map(([k, v]) => [k, v.size])),
  alerts,
}, null, 1));
