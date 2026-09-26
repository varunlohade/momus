#!/usr/bin/env node
/**
 * Open-ticket tracker for a Slack channel where the team logs issues, one
 * top-level message per ticket. Run it once a day.
 *
 * Convention: a ticket is RESOLVED when its message carries a "done"
 * reaction (✅ ✔️ ☑️ or a name listed in TICKET_DONE_REACTIONS). Replies alone
 * do not close a ticket, so nothing silently drops.
 *
 * Output: JSON on stdout —
 *   { counts, urgent[], openRecent[] }
 * urgent = open for TICKET_PENDING_DAYS or more, oldest first. Summaries and
 * reporter names have emails masked.
 *
 * Env: SLACK_BOT_TOKEN, TICKETS_CHANNEL (name or id), TICKET_WINDOW_DAYS
 * (default 14), TICKET_PENDING_DAYS (default 2).
 */

import { createSlack } from '../lib/slack.mjs';
import { maskEmail, summariseSlack } from '../lib/sanitize.mjs';

const slack = createSlack();
const WINDOW_DAYS = Number(process.env.TICKET_WINDOW_DAYS || 14);
const PENDING_DAYS = Number(process.env.TICKET_PENDING_DAYS || 2);
const DONE = new Set([
  'white_check_mark', 'heavy_check_mark', 'ballot_box_with_check', 'done',
  ...(process.env.TICKET_DONE_REACTIONS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

const channel = await slack.channelId(process.env.TICKETS_CHANNEL || 'tickets');
const { user_id: botId } = await slack.api('auth.test');
const now = Date.now() / 1000;

const messages = [];
let cursor;
for (let i = 0; i < 15; i++) {
  const page = await slack.api('conversations.history', {
    channel, limit: 200, oldest: (now - WINDOW_DAYS * 86400).toFixed(6), cursor,
  });
  messages.push(...(page.messages ?? []));
  cursor = page.response_metadata?.next_cursor;
  if (!cursor) break;
}

// Top-level human tickets only: skip joins, bot noise, and Momus's own posts.
const tickets = messages.filter((m) => !m.subtype && m.text?.trim() && m.user !== botId);

const out = [];
for (const m of tickets) {
  const reactions = (m.reactions ?? []).map((r) => r.name);
  let permalink = '';
  try {
    permalink = (await slack.api('chat.getPermalink', { channel, message_ts: m.ts })).permalink;
  } catch { /* leave blank */ }
  out.push({
    ts: m.ts,
    ageDays: Math.floor((now - Number(m.ts)) / 86400),
    resolved: reactions.some((r) => DONE.has(r)),
    summary: summariseSlack(m.text),
    reporter: maskEmail(await slack.userName(m.user)),
    permalink,
    replyCount: m.reply_count || 0,
  });
}

const open = out.filter((t) => !t.resolved);
const byAge = (a, b) => b.ageDays - a.ageDays;
const urgent = open.filter((t) => t.ageDays >= PENDING_DAYS).sort(byAge);
const openRecent = open.filter((t) => t.ageDays < PENDING_DAYS).sort(byAge);

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  windowDays: WINDOW_DAYS,
  pendingDays: PENDING_DAYS,
  counts: { total: out.length, open: open.length, urgent: urgent.length, resolved: out.length - open.length },
  urgent,
  openRecent,
}, null, 2));
