#!/usr/bin/env node
/**
 * Evidence for an investigation: recent Zendesk tickets on one theme (or
 * matching a phrase), with what the customer actually said.
 *
 *   node bin/zendesk-tickets.mjs --theme funds-stuck [--hours 48] [--limit 15]
 *   node bin/zendesk-tickets.mjs --match "send button" [--hours 72]
 *
 * Emails and phone numbers are stripped. The output is for the agent to
 * read — ticket ids stay so it can cite them in a PR, but it must never
 * post customer text or ids to Slack.
 */

import { classify } from '../lib/themes.mjs';
import { sanitizeQuote } from '../lib/sanitize.mjs';
import { customerText, pool, searchTickets, zendeskConfig } from '../lib/zendesk.mjs';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const theme = flag('--theme');
const match = flag('--match')?.toLowerCase();
if (!theme && !match) {
  console.error('usage: zendesk-tickets.mjs --theme <key> | --match "<phrase>" [--hours 48] [--limit 15]');
  process.exit(1);
}
const hours = Number(flag('--hours') || 48);
const limit = Number(flag('--limit') || 15);

const config = zendeskConfig();
const since = new Date(Date.now() - hours * 3_600_000).toISOString().slice(0, 19) + 'Z';
const tickets = await searchTickets(config, `updated>=${since}`, 500);

const hits = [];
await pool(tickets, 5, async (t) => {
  const text = await customerText(config, t);
  if (theme && classify(text) !== theme) return;
  if (match && !text.toLowerCase().includes(match)) return;
  hits.push({
    id: t.id,
    created: t.created_at,
    status: t.status,
    tags: t.tags,
    said: sanitizeQuote(text, 600),
  });
});

hits.sort((a, b) => Date.parse(b.created) - Date.parse(a.created));
console.log(JSON.stringify({ theme: theme || null, match: match || null, hours, total: hits.length, tickets: hits.slice(0, limit) }, null, 1));
